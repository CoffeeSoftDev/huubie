let apiVentas = '/app/facture/ctrl/ctrl-facture-ventas.php';
let app, ventas, ventasView;

// Copy de la cabecera del modulo. No son datos: ventas, KPIs, formas de pago,
// estados y periodo se consultan al servidor.
const VIEW_HEADER_VENTAS = {
    title:    'Ventas y pagos',
    subtitle: 'Explora las ventas, sus pagos y su estado fiscal. Filtra por periodo, forma de pago o estado',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

// useFetch del framework resuelve por callback; aqui el modulo encadena con
// await, asi que las llamadas pasan por este helper.
const fnAjax = (data, url) => fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(data)
}).then(r => r.json());

$(async () => {
    ventasView = new VentasView(apiVentas, 'root');
    ventas     = new Ventas(apiVentas, 'root');
    app        = new App(apiVentas, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ventas';
        this.selectedId   = null;
        this.periodMode   = 'rango';
    }

    async init() {
        const data = await fnAjax({ opc: 'init' }, apiVentas);
        const dia  = this.getDiaFromUrl();

        // El periodo arranca en el ultimo mes con ventas cargadas, que resuelve el
        // servidor: el Excel del POS se sube en diferido y el mes en curso puede no
        // tener una sola venta. Con ?dia= el modulo abre en ese dia, en modo Dia.
        this.periodMode = dia ? 'fecha' : 'rango';

        this.dataInit = {
            formas:  data.formas,
            estados: data.estados,
            dia:     dia,
            periodo: dia ? { fi: dia, ff: dia } : data.periodo
        };

        this.render();
    }

    getDiaFromUrl() {
        return new URLSearchParams(window.location.search).get('dia') || '';
    }

    render() {
        this.layout();
        this.filterBar();
        ventasView.renderHeader(VIEW_HEADER_VENTAS);
        ventasView.renderDetail(null);
        ventas.lsKpis();
        ventas.lsVentas();
    }

    // -- Layout --

    // Como en cargas: el unico borde de la zona superior es el de la banda del
    // titulo. Filtros y KPIs continuan esa banda con su mismo fondo, sin dibujar
    // una caja dentro de otra.
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
                    class: 'px-3 py-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'tableRow',
                    class: 'p-3 flex-1 min-h-0 flex flex-col'
                }
            ]
        };

        // Sin children: el panel lo pinta ventaDetailPanel sobre 'detailPanel'.
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
                // El listado ya no pagina: llega agrupado por dia y forma de pago,
                // y partirlo en paginas cortaria los grupos. Se recorre con el
                // scroll vertical de la tarjeta, con el encabezado fijo arriba.
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

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:   'div',
                id:    'periodGroup',
                lbl:   'Periodo de consulta:',
                class: 'col-12 col-md-5 col-lg-4'
            },
            {
                opc:      'select',
                id:       'fForma',
                lbl:      'Forma de pago:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.formas
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado fiscal:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.estados
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });

        this.periodPicker();
    }

    // "Periodo de consulta" es el control compuesto de pedidos/reportes: radios
    // Dia/Rango con su calendario dentro de una sola caja. El filterBar no lo trae
    // de fabrica, asi que se declara con `opc: 'div'` (cae en el default de
    // coffeeForm, que crea el elemento con los atributos del objeto y pinta su
    // label como el de cualquier campo) y aqui se rellena.
    periodPicker() {
        // La caja reusa la clase de campo del framework (CF_CSS.input tematizado),
        // asi hereda borde, radio, fondo y tipografia de los selects hermanos. Solo
        // se fija la altura: el px-3 py-2 de esa clase mas el contenido en linea
        // daria un alto distinto al del select, y el control quedaria desalineado.
        //   text-sm (1.25rem) + py-2 (2 x 0.5rem) + borde (2 x 1px)
        const boxClass   = this.cfThemedClass(CF_CSS.input, FACTURE_THEME) + ' flex items-center gap-2';
        const boxStyle   = 'height: calc(1.25rem + 1rem + 2px); padding-top: 0; padding-bottom: 0;';
        const innerReset = 'height: 100%; line-height: 1;';
        const modoFecha  = this.periodMode === 'fecha';

        $('#periodGroup').html(`
            <div class="${boxClass}" style="${boxStyle}">
                <label class="flex items-center gap-1 text-sm cursor-pointer whitespace-nowrap mb-0" style="${innerReset}">
                    <input type="radio" name="ventaPeriodMode" value="fecha" class="accent-blue-500 m-0" ${modoFecha ? 'checked' : ''}
                        onchange="app.setPeriodMode('fecha')"> Dia
                </label>
                <label class="flex items-center gap-1 text-sm cursor-pointer whitespace-nowrap mb-0" style="${innerReset}">
                    <input type="radio" name="ventaPeriodMode" value="rango" class="accent-blue-500 m-0" ${modoFecha ? '' : 'checked'}
                        onchange="app.setPeriodMode('rango')"> Rango
                </label>
                <span class="w-px bg-gray-600 flex-shrink-0" style="height: 16px;"></span>
                <input type="text" id="fFecha" readonly
                    class="period-fecha flex-1 min-w-0 bg-transparent text-sm border-0 outline-none p-0 m-0 cursor-pointer" style="${innerReset}" />
                <input type="text" id="fRango" readonly
                    class="period-rango flex-1 min-w-0 bg-transparent text-sm border-0 outline-none p-0 m-0 cursor-pointer" style="${innerReset}" />
                <span class="text-gray-400 flex-shrink-0 flex items-center"><i data-lucide="calendar" class="w-4 h-4"></i></span>
            </div>
        `);

        // type 'simple' => singleDatePicker con autoApply (sin botones).
        dataPicker({
            parent:      'fFecha',
            type:        'simple',
            rangeDefault: {
                singleDatePicker: true,
                showDropdowns:    true,
                autoApply:        true,
                startDate:        moment(this.dataInit.periodo.ff),
                locale:           this.pickerLocale()
            },
            onSelect: () => this.onChangeFilters()
        });

        dataPicker({
            parent: 'fRango',
            type:   'all',
            rangepicker: {
                startDate:     moment(this.dataInit.periodo.fi),
                endDate:       moment(this.dataInit.periodo.ff),
                showDropdowns: true,
                autoApply:     true,
                locale:        this.pickerLocale(),
                ranges:        this.pickerRanges()
            },
            onSelect: () => this.onChangeFilters()
        });

        if (window.lucide) lucide.createIcons();

        this.applyPeriodMode();
    }

    pickerLocale() {
        return {
            format:           'YYYY-MM-DD',
            applyLabel:       'Aplicar',
            cancelLabel:      'Cancelar',
            customRangeLabel: 'Personalizar',
            monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
        };
    }

    // Los atajos se calculan sobre el ultimo periodo cargado, no sobre hoy: el
    // Excel del POS se sube en diferido y "Mes actual" del calendario puede no
    // tener una sola venta.
    pickerRanges() {
        const ref = moment(this.dataInit.periodo.ff);

        return {
            'Mes cargado':      [ref.clone().startOf('month'), ref.clone().endOf('month')],
            'Mes anterior':     [ref.clone().subtract(1, 'month').startOf('month'), ref.clone().subtract(1, 'month').endOf('month')],
            'Primera quincena': [ref.clone().startOf('month'), ref.clone().date(15)],
            'Segunda quincena': [ref.clone().date(16), ref.clone().endOf('month')]
        };
    }

    // Solo se ve el calendario del modo activo: los dos inputs comparten la caja.
    applyPeriodMode() {
        $('.period-fecha').toggle(this.periodMode === 'fecha');
        $('.period-rango').toggle(this.periodMode === 'rango');
    }

    setPeriodMode(mode) {
        this.periodMode = mode;
        this.applyPeriodMode();
        this.onChangeFilters();
    }

    getFilters() {
        const rango = this.getRango();
        return {
            forma:  $('#fForma').val()  || '',
            estado: $('#fEstado').val() || '',
            fi:     rango.fi,
            ff:     rango.ff
        };
    }

    // En modo 'fecha' el picker es singleDatePicker, asi que fi === ff y el
    // periodo es un solo dia. Mientras dataPicker no engancha el plugin, el input
    // aun no tiene fechas.
    getRango() {
        const id = this.periodMode === 'fecha' ? 'fFecha' : 'fRango';

        if (!$(`#${id}`).data('daterangepicker')) {
            return { fi: this.dataInit.periodo.fi, ff: this.dataInit.periodo.ff };
        }

        return getDataRangePicker(id);
    }

    // -- Event handlers --

    async onChangeFilters() {
        await ventas.lsVentas();
        ventas.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectVenta(null);
        }
    }

    // La tabla ya viene filtrada del servidor: basta con ver si el folio
    // seleccionado sobrevivio al repintado.
    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    // -- Facade --

    async selectVenta(folio) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!folio) return ventasView.renderDetail(null);

        $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).closest('tr').addClass('row-active');

        const data = await fnAjax({ opc: 'getVenta', folio: folio }, apiVentas);
        ventasView.renderDetail(data.status === 200 ? data.venta : null);
    }
}

// -- Ventas --

class Ventas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ventas';
    }

    // -- Data --

    // El listado llega en dos niveles del servidor: el dia como grupo (opc 1) y la
    // forma de pago como subgrupo. Sin striped y sin DataTables: el color fuerte se
    // reserva para los encabezados de grupo, y paginar u ordenar por columna
    // partiria los bloques. Arranca plegado, de modo que la vista abre en el
    // resumen de los dias del periodo y se baja al detalle abriendo el que interesa.
    //
    // Columnas: 1 Folio, 2 Fecha, 3 Forma de pago, 4 Estado fiscal, 5 Tasa,
    // 6 Subtotal, 7 IVA, 8 IEPS, 9 Total, 10 Factura.
    async lsVentas() {
        const data = await fnAjax(Object.assign({ opc: 'lsVentas' }, app.getFilters()), apiVentas);

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        FACTURE_THEME,
            center:       [2, 3, 4, 5, 10],
            right:        [6, 7, 8, 9],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      false,
            hover:        true,
            folding:      true,
            collapsed:    true,
            color_group:  'ct-group',
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No se encontraron ventas con los filtros aplicados',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        this.foldSubgroups();
        this.rowSelect();

        if (window.lucide) lucide.createIcons();
    }

    // La fila completa abre el detalle, que es lo que el panel vacio ya promete
    // ("haz click en cualquier fila o en el icono ojo"): con el ojo como unica via
    // el resto de la fila quedaba muerta. Los encabezados de grupo y de forma de
    // pago no seleccionan: ahi el click es el del plegado.
    rowSelect() {
        $(`#tb${this.PROJECT_NAME}`).on('click', 'tbody tr', function (e) {
            if ($(e.target).closest('a, [data-sub-group], [data-folding-trigger]').length) return;

            const folio = $(this).find('[data-folio]').attr('data-folio');
            if (folio) app.selectVenta(folio);
        });
    }

    // Segundo nivel de plegado. El componente solo pliega las filas opc 1 (el dia),
    // asi que la forma de pago se engancha aqui con su propia clase: si usara el
    // `hidden` del componente, abrir el dia mostraria de golpe todos los tickets
    // aunque sus formas siguieran cerradas.
    foldSubgroups() {
        const $tabla = $(`#tb${this.PROJECT_NAME}`);

        $tabla.find('[data-sub-group]').closest('tr').addClass('ct-subgroup');
        $tabla.find('[data-sub-member]').closest('tr').addClass('sub-hidden');

        $tabla.on('click', '[data-sub-group]', function () {
            const clave   = $(this).attr('data-sub-group');
            const $filas  = $tabla.find(`[data-sub-member="${clave}"]`).closest('tr');
            const abierto = !$filas.first().hasClass('sub-hidden');

            $filas.toggleClass('sub-hidden', abierto);
            $(this).find('i').attr('class', abierto ? 'icon-right-open' : 'icon-down-open');
        });
    }

    async lsKpis() {
        const kpis = await fnAjax(Object.assign({ opc: 'showKpis' }, app.getFilters()), apiVentas);

        // El monto abre la fila: es la cifra que se busca primero al mover los
        // filtros, y las tres de conteo son su desglose.
        ventasView.renderInfoCards([
            {
                id:          'kpiMonto',
                title:       'Monto filtrado',
                lucideIcon:  'banknote',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.montoTexto,
                    // El azul del acento se apagaba sobre el panel oscuro y el monto
                    // es el dato que se busca primero: va en el verde del dinero.
                    color: 'text-[#3FC189]'
                }
            },
            {
                id:          'kpiVentas',
                title:       'Ventas',
                lucideIcon:  'receipt',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.ventas,
                    color: 'text-white'
                }
            },
            {
                id:          'kpiFacturados',
                title:       'Facturados',
                lucideIcon:  'lock',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.facturados,
                    color: 'text-green-600'
                }
            },
            {
                id:          'kpiCero',
                title:       'Con IVA 0%',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.cero,
                    color: 'text-amber-500'
                }
            }
        ]);
    }

}

// -- Vista --

class VentasView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ventas';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrVentas',
            json:   data
        });
    }

    renderInfoCards(rows) {
        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisVentas',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderDetail(venta) {
        this.ventaDetailPanel({
            parent:  'detailPanel',
            json:    venta,
            onClose: () => app.selectVenta(null)
        });
    }

    // -- Components --

    ventaDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'ventaDetailPanel',
            json:   null,
            labels: {
                emptyTitle:  'Selecciona una venta',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle fiscal aqui.',
                subtitle:    'Detalle fiscal',
                productos:   'PRODUCTOS',
                sinComanda:  'La comanda de esta venta no esta cargada',
                leyenda:     'Este detalle no es un comprobante fiscal'
            },
            onClose: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        if (!opts.json) {
            $parent.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                    <i data-lucide="inbox" class="w-10 h-10 text-gray-300 mb-3"></i>
                    <p class="text-sm font-semibold text-gray-400">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-xs text-gray-400 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e = opts.json;

        // Dentro del papel no van badges: sobre fondo blanco se pierden. Se usa
        // el mismo renglon monoespaciado del ticket impreso.
        const row = (k, v, strong) => `
            <tr>
                <td${strong ? ' class="font-bold text-[13px]"' : ''}>${esc(k)}</td>
                <td class="text-right${strong ? ' font-bold text-[13px]' : ''}">${esc(v)}</td>
            </tr>
        `;

        // Las comandas viven en otra hoja del export: si aun no se cargan, el
        // venta no tiene mesa, mesero ni partidas que mostrar.
        const items      = e.items || [];
        const mesaRow    = e.mesa     ? row('MESA:',    e.mesa)    : '';
        const meseroRow  = e.mesero   ? row('MESERO:',  e.mesero)  : '';
        const comandaRow = e.comanda  ? row('COMANDA:', e.comanda) : '';
        const horaRow    = e.apertura ? row('HORA:',    `${e.apertura} - ${e.cierre}`) : '';

        // Tres columnas (cantidad, producto, importe) en vez del par etiqueta/valor
        // de los totales: es la lista de consumo, no un dato del encabezado.
        const itemRow = (it) => `
            <tr>
                <td style="width:26px;">${esc(it.cantidad)}</td>
                <td>${esc(it.nombre)}${it.descuento ? ` (-${esc(it.descuento)}%)` : ''}</td>
                <td class="text-right">${esc(it.importe)}</td>
            </tr>
        `;

        const itemsHtml = items.length ? `
            <div class="tk-sep"></div>
            <p class="font-bold text-[11px]">${esc(opts.labels.productos)} (${items.length})</p>
            <table>${items.map(itemRow).join('')}</table>
            <table>${row('CONSUMO:', e.consumo)}</table>
        ` : `
            <div class="tk-sep"></div>
            <p class="text-center text-gray-400">${esc(opts.labels.sinComanda)}</p>
        `;

        $parent.html(`
            <div class="flex-1 flex flex-col overflow-hidden">
                <div class="px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-400 uppercase tracking-wider">${esc(opts.labels.subtitle)}</p>
                        <p class="text-base font-bold text-white font-mono">${esc(e.folio)}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${e.badge || ''}
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-[#1F2A37] hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-300 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto scroll-thin px-4 py-4 bg-[#0E1521]">
                    <div id="${opts.id}_paper" class="ticket-paper">
                        <div class="text-center">
                            <p class="font-bold text-[13px] tracking-wide">${esc(opts.labels.subtitle).toUpperCase()}</p>
                            <p>TICKET ${esc(e.folio)}</p>
                        </div>
                        <div class="tk-sep"></div>
                        <table>
                            ${row('FOLIO:',  e.folio)}
                            ${row('FECHA:',  e.fecha)}
                            ${comandaRow}
                            ${mesaRow}
                            ${meseroRow}
                            ${horaRow}
                            ${row('PAGO:',   String(e.pago).toUpperCase())}
                            ${row('METODO:', e.metodo)}
                        </table>
                        ${itemsHtml}
                        <div class="tk-sep"></div>
                        <table>
                            ${row('SUBTOTAL:',          e.subtotal)}
                            ${row(`IVA (${e.tasa}):`,   e.iva)}
                            ${row('IEPS:',              e.ieps)}
                            ${row('TOTAL:',             e.total, true)}
                        </table>
                        <div class="tk-sep"></div>
                        <table>
                            ${row('ESTADO:',  e.estado)}
                            ${row('FACTURA:', e.factura)}
                        </table>
                        <div class="tk-sep"></div>
                        <div class="text-center">
                            <p class="text-gray-400">${esc(opts.labels.leyenda)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose());
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
