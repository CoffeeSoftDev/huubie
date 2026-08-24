let apiVentas = '/app/facture/ctrl/ctrl-facture-ventas.php';
let app, ventas, ventasView;

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
        const data = await useFetch({ url: apiVentas, data: { opc: 'init' } });
        const dia  = this.getDiaFromUrl();

        // El periodo arranca en el ultimo mes con ventas cargadas, que resuelve el
        // servidor: el Excel del POS se sube en diferido y el mes en curso puede no
        // tener una sola venta. Con ?dia= el modulo abre en ese dia, en modo Dia.
        this.periodMode = dia ? 'fecha' : 'rango';

        this.dataInit = {
            formas:  data.formas,
            estados: data.estados,
            emisor:  data.emisor,
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
        ventasView.renderHeader();
        ventasView.renderDetail(null);
        ventas.lsKpis();
        ventas.lsVentas();
    }

    // -- Layout --

    // Misma configuracion que el visor de entradas del POS: cada zona de la banda
    // superior se separa con su propio borde, y los filtros van sobre el fondo de
    // cabecera para distinguirse de las cifras.
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
                //
                // El pr-2 es el aire entre la ultima columna y esa barra: sin el
                // queda pegada al borde de la tabla y se lee como una columna mas.
                //
                // La nota va fuera del wrapper con scroll: es la leyenda de la
                // tabla y tiene que seguir a la vista al recorrer el listado.
                container: [
                    {
                        type:  'div',
                        id:    'tableNote',
                        class: 'flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'tableWrap',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin pr-2'
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

        const data = await useFetch({ url: apiVentas, data: { opc: 'getVenta', folio: folio } });
        ventasView.renderDetail(data.status === 200 ? data.venta : null);
    }

    // El modulo de Tickets abre por dia, y por dia se entra: el enlace vive en el
    // encabezado del grupo, no en cada ticket.
    verTickets(dia) {
        window.location.href = `/app/facture2/tickets.php?dia=${dia}`;
    }
}

// -- Ventas --

class Ventas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ventas';
    }

    // -- Data --

    // El listado llega agrupado por dia del servidor (opc 1). Sin striped y sin
    // DataTables: el color se reserva para los encabezados de grupo, y paginar u
    // ordenar por columna partiria los bloques. Arranca plegado, de modo que la
    // vista abre en el resumen de los dias del periodo y se baja al detalle
    // abriendo el que interesa.
    //
    // Columnas: 1 Folio, 2 Fecha, 3 Forma de pago, 4 Estado fiscal, 5 Tasa,
    // 6 Subtotal, 7 IVA, 8 IEPS, 9 Total, 10 Factura.
    async lsVentas() {
        ventasView.renderLoader('Cargando ventas...');
        ventasView.renderTableNote(false);

        const data = await useFetch({ url: apiVentas, data: Object.assign({ opc: 'lsVentas' }, app.getFilters()) });

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

        this.rowSelect();
        this.markInvoiced();
        this.foldFormas();
        this.collapseFormas();

        // La leyenda explica una marca de las filas: mientras se consulta y sobre
        // el estado vacio no tiene nada que explicar, asi que solo sale con el
        // listado pintado.
        ventasView.renderTableNote((data.row || []).length > 0);

        if (window.lucide) lucide.createIcons();
    }

    // El componente arma la tabla celda por celda y no admite clases en el <tr>:
    // el servidor marca la celda del folio y aqui la marca sube a la fila, que es
    // lo que se pinta.
    markInvoiced() {
        $(`#tb${this.PROJECT_NAME} [data-invoiced]`).closest('tr').addClass('row-invoiced');
    }

    // La fila completa abre el detalle, que es lo que el panel vacio ya promete
    // ("haz click en cualquier fila o en el icono ojo"): con el ojo como unica via
    // el resto de la fila quedaba muerta. El encabezado del dia no selecciona: ahi
    // el click es el del plegado.
    rowSelect() {
        $(`#tb${this.PROJECT_NAME}`).on('click', 'tbody tr', function (e) {
            if ($(e.target).closest('a, [data-folding-trigger]').length) return;

            const folio = $(this).find('[data-folio]').attr('data-folio');
            if (folio) app.selectVenta(folio);
        });
    }

    // -- Plegado de los subgrupos de forma --

    // El componente solo pliega el bloque del dia (las filas opc 1). Los rotulos
    // de Efectivo y Bancos son filas normales, justamente para plegarse con su
    // dia, asi que su propio plegado se resuelve aqui.
    foldFormas() {
        const tabla = `#tb${this.PROJECT_NAME}`;

        $(tabla).on('click', 'td.ct-subgrupo', (e) => this.toggleForma($(e.currentTarget).closest('tr')));

        // Al abrir un dia el componente muestra todas sus filas de golpe, tambien
        // las de un subgrupo que quedo plegado: se les devuelve su estado.
        $(tabla).on('click', 'td[data-folding-trigger]', () => this.applyFormas());
    }

    toggleForma($fila) {
        const plegado = $fila.attr('data-forma-collapsed') === 'true';

        $fila.attr('data-forma-collapsed', plegado ? 'false' : 'true');
        this.formaMembers($fila).toggleClass('hidden', !plegado);

        $fila.find('.folding-sub')
             .toggleClass('icon-down-open', plegado)
             .toggleClass('icon-right-open', !plegado);
    }

    // Las filas de un subgrupo son las que siguen hasta el proximo rotulo o hasta
    // el dia siguiente. El aviso de tope queda fuera: es una banda del listado
    // entero (una celda con colspan), no una fila del bloque.
    formaMembers($fila) {
        return $fila.nextUntil('tr:has(td.ct-subgrupo), tr[data-group-header]').not(':has(td[colspan])');
    }

    applyFormas() {
        $(`#tb${this.PROJECT_NAME} tr[data-forma-collapsed="true"]`).each((i, fila) => {
            this.formaMembers($(fila)).addClass('hidden');
        });
    }

    // Los subgrupos nacen plegados, igual que los dias: al abrir un dia se lee su
    // reparto entre Efectivo y Bancos y de ahi se baja a los tickets del bloque
    // que interesa, en vez de recibir el listado entero de golpe. El chevron ya
    // viene cerrado del servidor; aqui se declara el estado, que vive en el <tr>
    // porque el componente no admite clases ni atributos en la fila.
    collapseFormas() {
        $(`#tb${this.PROJECT_NAME} tr:has(td.ct-subgrupo)`).attr('data-forma-collapsed', 'true');
        this.applyFormas();
    }

    async lsKpis() {
        const kpis = await useFetch({ url: apiVentas, data: Object.assign({ opc: 'showKpis' }, app.getFilters()) });

        // El monto abre la fila: es la cifra que se busca primero al mover los
        // filtros, y las tres de conteo son su desglose.
        ventasView.renderInfoCards([
            {
                id:    'kpiMonto',
                label: 'Monto filtrado',
                value: kpis.montoTexto,
                // El azul del acento se apagaba sobre el panel oscuro y el monto
                // es el dato que se busca primero: va en el verde del dinero.
                tone:  'success'
            },
            {
                id:    'kpiVentas',
                label: 'Ventas',
                value: kpis.ventas,
                tone:  'default'
            },
            {
                id:    'kpiFacturados',
                label: 'Facturados',
                value: kpis.facturados,
                tone:  'success'
            },
            {
                id:    'kpiCero',
                label: 'Con IVA 0%',
                value: kpis.cero,
                tone:  'warning'
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

    // Copy de la cabecera del modulo. No son datos: ventas, KPIs, formas de pago,
    // estados y periodo se consultan al servidor.
    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrVentas',
            json: {
                title:    'Ventas y pagos',
                subtitle: 'Explora las ventas, sus pagos y su estado fiscal. Filtra por periodo, forma de pago o estado',
                back:     { href: '/app/facture2/inicio.php', title: 'Regresar a la Terminal' }
            }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent: 'kpisRow',
            json:   rows
        });
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

    // El numero pegado al folio es el unico dato de la tabla que no se explica
    // solo: sin la leyenda, dos filas con el mismo folio se leen como un folio
    // repetido. Va arriba de la tabla, en el lugar del titulo que la tarjeta no
    // tiene, y con la misma pildora que usa la celda para que se reconozca.
    renderTableNote(hayVentas) {
        if (!hayVentas) return $('#tableNote').empty();

        this.noteBar({
            parent: 'tableNote',
            json: {
                badge: '1',
                text:  'Los tickets cobrados en varios pagos abren una fila por pago: el numero junto al folio dice cual de ellos es (1 el primer cobro, 2 el segundo).'
            }
        });
    }

    // La consulta de un rango largo tarda, y hasta que responde la tarjeta se
    // queda con el listado anterior o en blanco: el spinner ocupa ese hueco para
    // que se vea que la tabla se esta rehaciendo. Lo reemplaza createCoffeeTable3,
    // que repinta el contenido del wrapper.
    renderLoader(text) {
        this.spinnerBox({
            parent: 'tableWrap',
            json:   { text: text }
        });
    }

    renderDetail(venta) {
        this.ventaDetailPanel({
            parent:  'detailPanel',
            json:    venta,
            emisor:  app.dataInit.emisor,
            onClose: () => app.selectVenta(null)
        });
    }

    // -- Components --

    // Leyenda de una tabla: una linea de texto menudo, con una pildora de
    // muestra delante cuando lo que se explica es una marca de las celdas.
    noteBar(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center gap-2 mb-3 text-[10px] text-gray-400',
            json:   { badge: '', text: '' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            ${opts.json.badge ? `<span class="badge-base badge-xs b-gray flex-shrink-0">${esc(opts.json.badge)}</span>` : ''}
            <span>${esc(opts.json.text)}</span>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    // Espera de una consulta. Reemplaza el contenido del panel en vez de
    // agregarse a el (loader() del framework hace append y el aviso queda debajo
    // de la tabla, fuera de la vista) y se centra en el hueco que ocupa.
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

    ventaDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'ventaDetailPanel',
            json:   null,
            emisor: { razon: '', rfc: '', telefono: '', domicilio: '' },
            labels: {
                emptyTitle:  'Selecciona una venta',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle fiscal aqui.',
                subtitle:    'Detalle fiscal',
                productos:   'CANT. DESCRIPCION',
                importe:     'IMPORTE',
                sinComanda:  'La comanda de esta venta no esta cargada',
                leyenda:     'ESTE NO ES UN COMPROBANTE FISCAL'
            },
            onClose: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.emisor = Object.assign({}, defaults.emisor, o.emisor || {});

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
        const mesaRow    = e.mesa    ? row('MESA:',    e.mesa)    : '';
        const comandaRow = e.comanda ? row('COMANDA:', e.comanda) : '';

        // Tres columnas (cantidad, producto, importe) en vez del par etiqueta/valor
        // de los totales: es la lista de consumo, no un dato del encabezado.
        const itemRow = (it) => `
            <tr>
                <td style="width:26px;">${esc(it.cantidad)}</td>
                <td>${esc(it.nombre)}${it.descuento ? ` (-${esc(it.descuento)}%)` : ''}</td>
                <td class="text-right">${esc(it.importe)}</td>
            </tr>
        `;

        // Los renglones van bajo su encabezado de columnas, como en el papel del
        // POS: cantidad y descripcion a la izquierda, importe a la derecha.
        const itemsHtml = items.length ? `
            <table>
                <thead>
                    <tr>
                        <td class="font-bold" colspan="2">${esc(opts.labels.productos)}</td>
                        <td class="text-right font-bold">${esc(opts.labels.importe)}</td>
                    </tr>
                </thead>
                <tbody>${items.map(itemRow).join('')}</tbody>
            </table>
            <table>${row('CONSUMO:', e.consumo)}</table>
        ` : `
            <p class="text-center text-gray-400">${esc(opts.labels.sinComanda)}</p>
        `;

        const m        = opts.emisor;
        const emisorHtml = `
            <div class="text-center">
                ${m.razon     ? `<p class="font-bold text-[13px] tracking-wide">${esc(m.razon)}</p>` : ''}
                ${m.rfc       ? `<p>RFC: ${esc(m.rfc)}</p>` : ''}
                ${m.domicilio ? `<p>${esc(m.domicilio)}</p>` : ''}
                ${m.telefono  ? `<p>TEL: ${esc(m.telefono)}</p>` : ''}
            </div>
        `;

        // Los dos importes que el papel imprime en un mismo renglon bajo el total.
        const parRow = (k1, v1, k2, v2) => `
            <tr>
                <td>${esc(k1)}${esc(v1)}</td>
                <td class="text-right">${esc(k2)}${esc(v2)}</td>
            </tr>
        `;

        // El importe llega formateado del servidor ($0.00): se lee la cifra para
        // saber si hay algo que imprimir.
        const cifra = (txt) => parseFloat(String(txt == null ? '' : txt).replace(/[^0-9.-]/g, '')) || 0;

        // El origen no desglosa IEPS y casi siempre llega en cero: ese renglon no
        // se imprime, y el pago pasa a ocupar la linea.
        const pago    = String(e.pago).toUpperCase();
        const iepsRow = cifra(e.ieps) > 0
            ? parRow('IEPS:', e.ieps, 'PAGO:', pago)
            : parRow('PAGO:', pago,   '',      '');

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
                        ${emisorHtml}
                        <div class="tk-sep"></div>
                        <table>
                            ${mesaRow}
                            ${comandaRow}
                            ${row('FOLIO:', e.folio)}
                            ${row('FECHA:', e.fecha)}
                        </table>
                        <div class="tk-sep"></div>
                        ${itemsHtml}
                        <div class="tk-total">
                            <table>
                                ${row('TOTAL:', e.total, true)}
                            </table>
                        </div>
                        <table>
                            ${parRow('SUBTOTAL:', e.subtotal, `IVA (${e.tasa}):`, e.iva)}
                            ${iepsRow}
                        </table>
                        <p class="text-center font-bold mt-2">${esc(opts.labels.leyenda)}</p>
                        <div class="tk-sep"></div>
                        <table>
                            ${row('METODO:',  e.metodo)}
                            ${row('ESTADO:',  e.estado)}
                            ${row('FACTURA:', e.factura)}
                        </table>
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
