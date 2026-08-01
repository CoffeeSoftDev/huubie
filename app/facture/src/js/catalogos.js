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

    // La clase vive aqui y no en el campo: el filterBar se repinta al cambiar de vista.
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
        this.view         = 'productos';
        this.clase        = 'puente';
    }

    async init() {
        this.dataInit = await useFetch({ url: apiCatalogos, data: { opc: 'init' } });

        this.render();
    }

    render() {
        this.layout();
        catalogosView.renderHeader();
        this.filterBar();

        if (this.view === 'productos') {
            catalogosView.renderNote();
            catalogos.lsProductos();
        } else {
            catalogosView.renderEmisor(this.dataInit.emisor);
        }
    }

    // -- Layout --

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
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
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

    cardLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:        'cardCatalogo',
                class:     'w-full flex-1 min-h-0 bg-[#1F2A37] rounded-lg p-4 flex flex-col overflow-hidden',
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
        if (this.view === 'emisor') return;

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
                id:       'fClase',
                lbl:      'Tipo de producto:',
                class:    'col-12 col-md-3 col-lg-2',
                value:    this.clase,
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
                class:     'col-12 col-md-4 col-lg-2',
                onClick:   () => catalogosView.openProductoForm()
            }
        ];
    }

    // El buscador no esta pintado: q viaja vacio porque el servidor arma el LIKE con el.
    // La marca viaja como 'clase' y no como 'tipo': createTable reserva esa llave para
    // el modo de validar_contenedor, y un 'tipo' propio le impediria armar el envio.
    getFilters() {
        return {
            q:     '',
            clase: this.clase
        };
    }

    onChangeFilters() {
        this.clase = $('#fClase').val() || '';

        catalogos.lsProductos();
    }

    emptyMessage() {
        return this.clase === 'puente'
            ? 'Aun no hay productos auxiliares dados de alta'
            : 'No hay productos con el filtro aplicado';
    }

    // -- Vistas --

    setView(view) {
        this.view = view;
        this.render();
    }
}

// -- Catalogos --

class Catalogos extends App {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Data --

    // createTable pide los datos, pinta con createCoffeeTable3 y monta DataTables en
    // una sola pasada. Los kpis viajan en esa misma respuesta (ctrl:lsProductos), asi
    // que el interruptor de la celda solo da una vuelta al servidor para refrescar
    // tabla y tarjetas.
    lsProductos() {
        this.createTable({
            parent:      'viewBody',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            coffeesoft:  true,
            data:        Object.assign({ opc: 'lsProductos' }, app.getFilters()),
            attr: {
                id:           'tbProductos',
                theme:        FACTURE_THEME,
                center:       [4, 5, 6],
                right:        [3],
                actionsAlign: 'center',
                hover:        true,
                f_size:       11,
                border_table: 'border-0',
                emptyMessage: app.emptyMessage(),
                emptyIcon:    'ic-box'
            },
            conf: {
                fn_datatable: 'dataTableCatalogos',
                pag:          12
            },
            methods: {
                send: (data) => { if (data.kpis) catalogosView.renderInfoCards(data.kpis); }
            }
        });
    }

    // -- Actions --

    // 'previo' localiza la fila cuando la edicion cambia la clave del POS. La marca no
    // se pregunta en el formulario: en el alta viaja fija y en la edicion la que ya
    // tiene el producto, que puede no ser auxiliar.
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
            theme: FACTURE_THEME,
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

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

        this.alertBox({ theme: FACTURE_THEME, type: 'error', title: response.message });
    }

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
            theme: FACTURE_THEME,
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

    refresh() {
        this.lsProductos();
    }
}

// -- Vista --

class CatalogosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Render helpers --

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

    renderInfoCards(kpis) {
        this.kpisRow({
            parent: 'kpisRow',
            json:   this.jsonKpisProductos(kpis)
        });
    }

    jsonKpisProductos(kpis) {
        return [
            {
                id:    'kpiProductos',
                label: 'Productos',
                value: kpis.productos,
                tone:  'default'
            },
            {
                id:    'kpiPuente',
                label: 'Productos auxiliares',
                value: kpis.puente,
                tone:  'success'
            },
            {
                id:    'kpiModificadores',
                label: 'Modificadores',
                value: kpis.modificadores,
                tone:  'warning'
            },
            {
                id:    'kpiPrecio',
                label: 'Precio promedio',
                value: kpis.precioPromedio,
                tone:  'info'
            }
        ];
    }

    // -- Forms --

    renderEmisor(emisor) {
        $('#viewBody').html(`
            <div id="emisorHead" class="pb-3 border-b border-[#374151]"></div>
            <div class="pt-4 flex flex-col lg:flex-row gap-4 items-start">
                <div id="emisorCard" class="flex-1 min-w-0 w-full bg-[#141d2b] rounded-lg p-4">
                    <div id="emisorCardHead" class="pb-3 mb-3 border-b border-[#374151]"></div>
                    <div id="formEmisor"></div>
                </div>
                <div id="emisorPreview" class="w-full lg:w-[320px] flex-shrink-0 bg-[#141d2b] rounded-lg p-4">
                    <div id="previewHead" class="pb-3 mb-3 border-b border-[#374151]"></div>
                    <div id="ticketPrintArea"></div>
                </div>
            </div>
        `);

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

        this.panelHead({
            parent: 'emisorCardHead',
            json: {
                icon:  'building-2',
                title: 'Datos de la empresa'
            }
        });

        this.panelHead({
            parent: 'previewHead',
            json: {
                icon:  'printer',
                title: 'Vista previa del ticket',
                badge: {
                    text: 'muestra',
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

        this.renderEmisorPreview(emisor);

        // El papel repite el encabezado que se esta escribiendo: sin esto la
        // muestra quedaria con los datos guardados hasta recargar la vista.
        $('#frmEmisor').on('input', () => this.renderEmisorPreview(this.getEmisorForm()));
    }

    getEmisorForm() {
        return {
            razon:     $('#razon').val(),
            rfc:       $('#rfc').val(),
            telefono:  $('#telefono').val(),
            domicilio: $('#domicilio').val()
        };
    }

    // Los renglones son de muestra: lo que el emisor gobierna es el encabezado del
    // papel, y el cuerpo esta para leerlo en su contexto.
    renderEmisorPreview(emisor) {
        this.ticketPaper({
            parent: 'ticketPrintArea',
            emisor: emisor,
            json: {
                nota:      'A-1024',
                fecha:     '01/07/2026',
                hora:      '14:32',
                folio:     'MUESTRA',
                subtotal:  '$260.00',
                descuento: '$10.00',
                total:     '$250.00',
                metodo:    'efectivo',
                lineas: [
                    { cant: 2, nombre: 'Producto auxiliar A', importe: '$120.00' },
                    { cant: 1, nombre: 'Producto auxiliar B', importe: '$140.00' }
                ]
            }
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

    // El registro se pide al servidor: la tabla viene armada como HTML y el formulario
    // necesita los campos en crudo.
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

    // El papel se queda blanco aunque el modulo sea dark: representa el ticket
    // impreso. Los renglones del encabezado sin dato no se pintan vacios.
    ticketPaper(options) {
        const defaults = {
            parent: 'root',
            id:     'ticketPaper',
            class:  'ticket-paper',
            json:   null,
            emisor: { razon: '', domicilio: '', telefono: '' },
            labels: {
                empty:   'Sin ticket que mostrar',
                leyenda: 'ESTE NO ES UN COMPROBANTE FISCAL'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.emisor = Object.assign({}, defaults.emisor, o.emisor || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            wrap.html(`<p class="text-center text-[11px] text-gray-400 py-8">${esc(opts.labels.empty)}</p>`);

            return $(`#${opts.parent}`).html(wrap);
        }

        const e = opts.json;
        const m = opts.emisor;

        const row = (k, v) => v ? `<tr><td>${esc(k)}</td><td class="text-right">${esc(v)}</td></tr>` : '';

        const lineas = (e.lineas || []).map(l => `
            <tr>
                <td>${esc(l.cant)}&nbsp;&nbsp;${esc(l.nombre)}</td>
                <td style="text-align:right">${esc(l.importe)}</td>
            </tr>
        `).join('');

        // Los dos importes que el papel imprime en un mismo renglon bajo el total.
        const parRow = (k1, v1, k2, v2) => `
            <tr>
                <td>${esc(k1)}${esc(v1)}</td>
                <td class="text-right">${esc(k2)}${esc(v2)}</td>
            </tr>
        `;

        wrap.html(`
            <div class="text-center">
                <p class="font-bold text-[13px] tracking-wide">${esc(m.razon)}</p>
                ${m.rfc ? `<p>RFC: ${esc(m.rfc)}</p>` : ''}
                <p>${esc(m.domicilio)}</p>
                ${m.telefono ? `<p>TEL: ${esc(m.telefono)}</p>` : ''}
            </div>
            <div class="tk-sep"></div>
            <table>
                <tr><td>NOTA:</td><td class="text-right font-bold">${esc(e.nota)}</td></tr>
                ${row('TICKET:', e.folio)}
                ${row('FECHA:',  `${e.fecha} ${e.hora}`)}
            </table>
            <div class="tk-sep"></div>
            <table>
                <thead>
                    <tr><td class="font-bold">CANT. DESCRIPCION</td><td class="text-right font-bold">IMPORTE</td></tr>
                </thead>
                <tbody>${lineas}</tbody>
            </table>
            <div class="tk-total">
                <table>
                    <tr><td class="font-bold text-[13px]">TOTAL:</td><td class="text-right font-bold text-[13px]">${esc(e.total)}</td></tr>
                </table>
            </div>
            <table>
                ${parRow('SUBTOTAL:', e.subtotal, 'DESCUENTO:', '-' + e.descuento)}
                ${parRow('PAGO:',     String(e.metodo).toUpperCase(), '', '')}
            </table>
            <p class="text-center font-bold mt-2">${esc(opts.labels.leyenda)}</p>
            <div class="tk-sep"></div>
            <div class="text-center">
                <p>GRACIAS POR SU VISITA</p>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-4 gap-3',
            json:   [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:     'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass:    'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)]',
            valueClass:    'cs-kpi-value text-sm font-bold',
            subtitleClass: 'cs-kpi-subtitle text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
            onClick:       () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.tones  = Object.assign({}, defaults.tones,  o.tones  || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const kpiCard = (kpi, idx) => {
            const cardId = kpi.id || `${opts.id}_${idx}`;

            return `
                <div id="${cardId}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                    <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                    <p class="${opts.valueClass} ${toneClass(kpi.tone)}" id="${cardId}_value">${esc(kpi.value)}</p>
                    ${kpi.subtitle ? `<p class="${opts.subtitleClass}">${esc(kpi.subtitle)}</p>` : ''}
                </div>
            `;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`
                <p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">
                    ${esc(opts.labels.empty)}
                </p>
            `);

            return $(`#${opts.parent}`).html(grid);
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));

        $(`#${opts.parent}`).html(grid);

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);

            opts.onClick(opts.json[idx], idx);
        });
    }

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

// -- Complementos --

// createTable la busca en window y la llama despues de pintar. Sin filas
// createCoffeeTable3 escribe el aviso de vacio y no un <table>: DataTables dejaria
// la paginacion colgando debajo del mensaje.
function dataTableCatalogos(id, pag) {
    if (!$(id).length) return;

    if (typeof simple_data_table === 'function') simple_data_table(id, pag);
}
