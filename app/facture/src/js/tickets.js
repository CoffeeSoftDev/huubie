let apiTickets = '/app/facture/ctrl/ctrl-facture-tickets.php';
let app, tickets, ticketsView;

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
    }

    // El dia lo resuelve el servidor: el Excel del POS se sube en diferido, asi que
    // el modulo abre en el ultimo dia con cobros por banco. Con ?dia= entra a ese.
    async init() {
        this.dataInit = await useFetch({ url: apiTickets, data: { opc: 'init', dia: this.getParam('dia') } });

        this.hideTitleOnPrint();
        this.render();
    }

    getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
    }

    // El encabezado que el navegador estampa en cada hoja se arma con la fecha y el
    // titulo de la pagina, y el ticket entregado no tiene por que anunciar de que
    // sistema salio. El titulo se vacia mientras dura la impresion y se repone al
    // cerrar el dialogo, porque en pantalla si nombra a la pestana.
    //
    // El @page sin margen de facture.css es lo que quita el encabezado completo;
    // esto es el respaldo para cuando el usuario imprime con "Encabezados y pies de
    // pagina" marcado, que es ajuste del navegador y no se puede tocar desde aqui.
    hideTitleOnPrint() {
        const titulo = document.title;

        window.addEventListener('beforeprint', () => { document.title = ''; });
        window.addEventListener('afterprint',  () => { document.title = titulo; });
    }

    render() {
        this.layout();
        this.filterBar();
        this.previewActions();
        ticketsView.renderFooter();
        ticketsView.renderListNote();
        this.updateHeaderTitle();
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
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 pt-3 pb-1 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'listHead',
                    class: 'px-4 py-3 bg-[#0E1521] flex items-center justify-between flex-wrap gap-2 flex-shrink-0'
                },
                {
                    id:    'tableRow',
                    class: 'p-3 flex-1 min-h-0 flex flex-col'
                },
                {
                    id:    'listNote',
                    class: 'px-4 py-2 bg-[#141d2b] flex-shrink-0'
                },
                // La hoja del dia solo existe para el papel: en pantalla no se ve y
                // @media print la saca a imprimir, igual que #ticketPrintArea.
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
                    },
                    {
                        type:  'div',
                        id:    'detailActions',
                        class: 'px-3 py-2 bg-[#0E1521] flex-shrink-0'
                    }
                ]
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

    // Los tres botones se pintan de una vez y se muestran segun el estado del dia
    // (ver syncActionButtons). Repintar la barra en cada listado le quitaria el foco
    // al selector de fecha justo cuando se esta usando.
    filterBar() {
        const filters = [
            {
                opc:      'input',
                id:       'fDia',
                lbl:      'Dia:',
                type:     'date',
                class:    'col-12 col-md-4 col-lg-3',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnGenerarTodos',
                text:      'Generar tickets IVA 0%',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.generateDay()
            },
            {
                opc:       'button',
                id:        'btnImprimirTodos',
                text:      'Imprimir tickets',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.printSheet()
            },
            {
                opc:       'button',
                id:        'btnRehacer',
                text:      'Rehacer reparto',
                color_btn: 'secondary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.redoDay()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });
    }

    // Repartir el dia y sacar el papel son dos momentos distintos, y solo uno de los
    // dos tiene sentido a la vez: mientras el dia no se reparte no hay nada que
    // imprimir, y una vez repartido volver a correrlo es rehacerlo.
    //
    // Se esconde la columna, no el boton: el <button> vive dentro de su celda de la
    // rejilla y ocultarlo solo dejaria el hueco.
    syncActionButtons(counts) {
        const repartido = (counts.generados || 0) > 0;
        const columna   = (id) => $(`#${id}`).closest('[class*="col-"]');

        columna('btnGenerarTodos').toggle(!repartido);
        columna('btnImprimirTodos').toggle(repartido);
        columna('btnRehacer').toggle(repartido);
    }

    // Acciones del ticket virtual: viven en el pie del aside, no en la filterBar,
    // porque operan sobre el ticket seleccionado y no sobre el listado.
    previewActions() {
        this.createfilterBar({
            parent:     'detailActions',
            id:         'frmActionsTickets',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:       'button',
                    id:        'btnRegenerar',
                    text:      'Generar',
                    color_btn: 'secondary',
                    class:     'col-6',
                    onClick:   () => tickets.generate()
                },
                {
                    opc:       'button',
                    id:        'btnImprimir',
                    text:      'Imprimir',
                    color_btn: 'invernal',
                    class:     'col-6',
                    onClick:   () => tickets.printTicket()
                }
            ]
        });
    }

    getFilters() {
        return {
            dia: $('#fDia').val()    || this.dataInit.dia
        };
    }

    // -- Event handlers --
    onChangeFilters() {
        this.updateHeaderTitle();
        tickets.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    // El listado ya viene filtrado del servidor: basta con ver si el folio
    // seleccionado sobrevivio al repintado.
    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    // Copy de la cabecera del modulo. No son datos: tickets, emisor y renglones del
    // ticket virtual se consultan al servidor.
    updateHeaderTitle() {
        const header = {
            title:    'Tickets',
            subtitle: 'Tickets virtuales del dia, de lo cobrado por banco. Lo pagado en efectivo no se muestra. Las notas se reinician cada dia',
            back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
        };

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f         = this.getFilters();
        const fecha     = String(f.dia || '').split('-').reverse().join('/');
        const titleHtml = `${header.title} <span class="font-bold" style="color:#1C64F2;">&middot; ${esc(fecha)}</span>`;

        ticketsView.renderHeader(Object.assign({}, header, { titleHtml }));
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    // El papel se pide al servidor: si el ticket ya se genero llegan los renglones
    // guardados y si no, la propuesta con la que se armaria.
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
    }

    // Tabla de tickets
    async lsTickets() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'lsTickets' }, app.getFilters()) });

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        FACTURE_THEME,
            center:       [1, 2, 3,  4, 5],
            right:        [6],
            actionsAlign: 'right',
            extends:      true,
            scrollable:   false,
            hover:        true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No hay cobros por banco en el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable(`#tb${this.PROJECT_NAME}`, data);

        const counts = data.counts || { facturados: 0, cero: 0, generados: 0, mostrados: 0 };

        app.dataKpis = data.kpis || {};

        ticketsView.renderListHead(counts);
        ticketsView.renderKpis(app.dataKpis);
        app.syncActionButtons(counts);

        app.updateFooterInfo(`Mostrando ${counts.mostrados} ticket${counts.mostrados !== 1 ? 's' : ''} cobrados por banco`);
    }

    // Paginado, buscador y ordenamiento de la tabla ya pintada. Sin filas
    // createCoffeeTable3 no arma un <table> sino el aviso de vacio, asi que montar
    // DataTables ahi dejaria la paginacion colgando debajo del mensaje.
    dataTable(id, data) {
        if (!(data.row || []).length) return;

        if (typeof simple_data_table === 'function') simple_data_table(id, 100);
    }

    // -- Actions --

    // El cierre del dia: el servidor decide que se factura al 16% y que se manda al
    // 0% y arma el papel de los segundos. No imprime nada; el papel sale con el otro
    // boton, que aparece justo cuando esto termina.
    //
    // Va sin preguntar porque solo se ofrece en el dia que todavia no se reparte: no
    // hay nada que reemplazar. El que si pregunta es redoDay().
    async generateDay() {
        const response = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'generateDay' }, app.getFilters()) });

        if (response.status !== 200) {
            this.alertBox({ theme: FACTURE_THEME, type: 'error', title: response.message, timer: 0 });
            return;
        }

        await this.lsTickets();

        ticketsView.renderResumenReparto(response);
    }

    // Volver a repartir un dia ya cerrado. La confirmacion dice lo que esta en juego
    // porque la corrida REEMPLAZA el reparto anterior: un ticket que estaba al 0%
    // puede pasar al 16% y soltar su papel.
    redoDay() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Rehacer el reparto del dia',
                text:              'Se vuelve a repartir la venta del dia entre IVA 16% e IVA 0%, y se reemplazan los tickets que ya se generaron. Las notas no cambian.',
                icon:              'question',
                confirmButtonText: 'Si, rehacer',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed) this.generateDay();
        });
    }

    // La hoja del dia: se piden los papeles ya armados, se pintan en el contenedor
    // que solo existe para imprimir y se abre el dialogo del navegador. El PDF lo
    // guarda el usuario desde ahi.
    async printSheet() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'showPrintSheet' }, app.getFilters()) });

        if (data.status !== 200) {
            this.alertBox({ type: 'error', title: data.message, timer: 0 });
            return;
        }

        ticketsView.renderPrintSheet(data.tickets, data.emisor);

        // La clase le dice al @media print cual de los dos trabajos es: la hoja
        // del dia o el ticket del panel. Se quita al cerrar el dialogo para que la
        // siguiente impresion vuelva a ser la del ticket seleccionado.
        $('body').addClass('printing-sheet');
        window.print();
        $('body').removeClass('printing-sheet');
    }

    // Los del 0% son el trabajo del cierre: sin IVA trasladado el ticket del POS no
    // sirve para facturar, asi que se les arma su ticket virtual de una pasada.
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

            const response = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'generateAllZero' }, app.getFilters()) });

            this.afterGenerate(response, response.folio);
        });
    }

    // Genera (o vuelve a generar) el ticket seleccionado. Regenerar conserva su
    // numero de nota: ya se entrego y no puede cambiar.
    async generate() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }

        const response = await useFetch({ url: apiTickets, data: { opc: 'generate', folio: app.selectedId } });

        this.afterGenerate(response, app.selectedId);
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

    async lockedNotice(folio) {
        const data = await useFetch({ url: apiTickets, data: { opc: 'getTicket', folio: folio } });

        if (data.status !== 200) return;

        this.alertBox({ type: 'message', title: `El ticket ya esta facturado con el folio ${data.ticket.factura}` });
    }
}

// Vista lateral del ticket seleccionado.
class TicketsView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrTickets',
            json:   data
        });
    }

    renderFooter() {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json: {
                info: '',
                legends: [
                    { tone: 'success', label: 'Facturado (bloqueado)'   },
                    { tone: 'info',    label: 'IVA 0% · ticket generado' },
                    { tone: 'warning', label: 'Requiere ticket virtual' },
                    { tone: 'default', label: 'No facturado'   }
                ]
            }
        });
    }

    renderListNote() {
        this.noteBox({
            parent: 'listNote',
            json:   { text: 'Al generar, el sistema arma una lista de productos de tasa 0% que suman el total del ticket. Esos productos se dan de alta en Catalogos; si la combinacion excede el monto, se aplica un descuento para cuadrar.' }
        });
    }

    // Tarjetas del dia: la venta por banco, la meta a la que hay que llegar, lo que
    // ya quedo cubierto y lo que falta. Los montos llegan escritos del servidor; lo
    // unico que se arma aqui es el copy que los acompana.
    //
    // El fondo se elige por tema: Resumen lo trae fijo en oscuro y en la vista clara
    // se le ven tarjetas negras. Aqui no.
    renderKpis(k) {
        const bgColor     = FACTURE_THEME_IS_LIGHT ? 'bg-white' : 'bg-[#141d2b]';
        const borderColor = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-transparent';
        const textColor   = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';

        const card = (id, title, lucideIcon, value, subtitle, color) => ({
            id, title, lucideIcon, bgColor, borderColor,
            data: { value: value || '$0.00', subtitle: subtitle, color: color }
        });

        const pctCero      = k.metaCeroPct || 30;
        const tituloCero   = k.ceroGenerado ? 'IVA 0% obtenido / objetivo' : 'Monto objetivo para IVA 0%';
        const valorCero    = k.ceroGenerado
            ? `${k.obtenidoCeroTexto} / ${k.objetivoCeroTexto}`
            : k.objetivoCeroTexto;
        const subtituloCero = k.ceroGenerado
            ? `${pctCero}% de la venta · ${k.difCeroTexto} vs objetivo`
            : `${pctCero}% de la venta por banco`;

        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisTickets',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   5,
            json: [
                // El subtitulo dice "solo banco" porque es justo lo que separa este
                // total del de Resumen, que suma tambien el efectivo.
                card('kpiTotalDia', 'Venta del dia', 'banknote', k.totalTexto,
                     `${k.tickets || 0} tickets · solo banco`, textColor),

                card('kpiMeta', 'Monto objetivo para IVA 16%', 'target', k.objetivoTexto,
                     `${k.metaPct || 70}% de la venta por banco`, textColor),

                card('kpiFacturado', 'Ya facturado', 'lock', k.facturadoTexto,
                     `${k.facturados || 0} tickets facturados realmente`, 'text-green-600'),

                card('kpiPorFacturar', 'Por facturar al IVA 16%', 'alert-circle', k.porFacturarTexto,
                     `${k.metaPct || 70}% de la venta - Facturado`, 'text-[#1C64F2]'),

                // La unica tarjeta con dos montos: el 0% es lo que el reparto arma,
                // asi que se muestra lo que se obtuvo contra lo que se debio obtener.
                // Mientras el dia no tenga reparto corrido solo se muestra el objetivo.
                card('kpiObjetivoCero', tituloCero, 'alert-circle', valorCero,
                     subtituloCero, 'text-[#1C64F2]')
            ]
        });
    }

    // El corte que se muestra al terminar el reparto. Todos los montos llegan
    // escritos del servidor; aqui solo se acomodan en dos columnas.
    //
    // Los renglones van con <span class="block"> y no con <div>: alertBox mete este
    // html dentro de un <p>, y un <div> ahi adentro lo parte en dos.
    renderResumenReparto(r) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        // Rebasar el objetivo no es un error: el ticket que cruza la meta entra
        // completo. Se pinta en azul, y en ambar solo lo que se quedo corto.
        const dif = (texto) => {
            const color = String(texto).startsWith('+') ? 'text-[#1C64F2]' : 'text-amber-400';
            return `<span class="${color} ml-2">${esc(texto)}</span>`;
        };

        // El titulo de cada bloque lleva la tasa —que es de lo que habla el reparto—
        // y a un lado, en chico, que tajada de la venta le toca.
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

        // Los conteos no son montos: el numero va pegado a su etiqueta y el desglose
        // queda a la derecha, para no leerlos como una columna de dinero.
        const conteo = (etiqueta, cuantos, detalle) => `
            <span class="block flex items-baseline justify-between gap-3 pl-3">
                <span class="text-gray-500">${esc(etiqueta)}
                    <span class="font-mono text-gray-300 font-semibold ml-1">${esc(cuantos)}</span>
                </span>
                <span class="text-gray-500">${detalle}</span>
            </span>
        `;

        const separador = '<span class="block border-t border-[#374151] my-2.5"></span>';

        this.alertBox({
            theme:   FACTURE_THEME,
            type:    'success',
            title:   `Reparto del ${r.fechaTexto}`,
            width:   'w-[430px]',
            timer:   0,
            okLabel: 'Entendido',
            detailHtml: `
                <span class="block flex items-baseline justify-between gap-3">
                    <span class="text-gray-300 font-semibold">Monto del dia</span>
                    <span class="font-mono text-gray-200 font-semibold">${esc(r.totalTexto)}</span>
                </span>
                ${separador}
                ${titulo('Objetivo IVA 16%', r.metaPct, r.objetivoTexto)}
                ${renglon('ya facturado', r.facturadoTexto)}
                ${renglon('por cubrir con tickets', r.porCubrirTexto)}
                ${renglon('logrado', r.logrado16Texto, dif(r.dif16Texto))}
                ${separador}
                ${titulo('Objetivo IVA 0%', r.metaCeroPct, r.objetivoCeroTexto)}
                ${renglon('logrado', r.logrado0Texto, dif(r.dif0Texto))}
                ${separador}
                <span class="block text-gray-300 font-semibold mt-1">${esc(r.tickets)} tickets del dia</span>
                ${conteo('al IVA 16%', r.cuenta16Total, `${esc(r.facturados)} facturados + ${esc(r.cuenta16)} reales`)}
                ${conteo('al IVA 0%',  r.cuenta0, 'con ticket virtual')}
                ${r.sinPapel ? conteo('sin papel', r.sinPapel, '<span class="text-amber-400">faltan productos de tasa 0%</span>') : ''}
            `
        });
    }

    // La hoja del dia: un papel por venta, todos con el mismo componente que pinta
    // el ticket del panel lateral. Cada uno estrena su propio contenedor porque
    // ticketPaper reemplaza el contenido de su padre, no lo acumula.
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

    renderListHead(counts) {
        this.panelHead({
            parent: 'listHead',
            json: {
                icon:  'receipt',
                title: 'Tickets del dia cobrados por banco',
                badges: [
                    { text: `${counts.generados} generados`,   tone: 'b-blue'   },
                    { text: `${counts.facturados} bloqueados`, tone: 'b-green'  },
                    { text: `${counts.cero} con IVA 0%`,       tone: 'b-yellow' }
                ]
            }
        });
    }

    // El aviso del pie explica el ticket que se esta viendo: cuando no se pudo
    // armar (sin productos de tasa 0% dados de alta) dice por que en vez de
    // quedarse mudo.
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
                icon:   'printer',
                title:  ticket ? `Ticket virtual · Nota ${ticket.nota}` : 'Ticket virtual',
                badges: ticket
                    ? [
                        { text: ticket.tasaText === '0%' ? 'IVA 0%' : `IVA ${ticket.tasaText}`, tone: ticket.tasaText === '0%' ? 'b-yellow' : 'b-terra' },
                        // El que no se genero ya no es una propuesta: es el consumo
                        // real con el que la venta se factura al 16%.
                        { text: ticket.generado ? 'papel guardado' : 'consumo real', tone: ticket.generado ? 'b-blue' : 'b-gray' }
                      ]
                    : []
            }
        });

        this.noteBox({
            parent: 'detailNote',
            class:  'text-[10px] text-gray-400 text-center',
            json: {
                icon: '',
                // El copy depende de que papel se esta viendo: el inventado explica
                // el cuadre con la tasa 0% y el real explica su desglose fiscal.
                text: ticket
                    ? (ticket.grupo === 'cero'
                        ? `${ticket.lineas.length} renglon(es) de productos de tasa 0% suman ${ticket.subtotal}, con un descuento de ${ticket.descuento} para cuadrar los ${ticket.total} del ticket.`
                        : `Consumo real del ticket: ${ticket.subtotal} de base mas ${ticket.iva} de IVA ${ticket.tasaText} dan los ${ticket.total} que se cobraron.`)
                    : (motivo || 'Selecciona un ticket de la lista para armar su ticket virtual.')
            }
        });
    }

    // -- Components --

    // El papel del ticket vive en components/ticketPaper.js: lo comparten este
    // modulo y la vista previa del emisor en Catalogos, que muestran el mismo
    // papel y tienen que verse identicos.
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

        const iconHtml   = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badgesHtml = (opts.json.badges || [])
            .map(b => `<span class="badge-base ${esc(b.tone || 'b-gray')}">${esc(b.text)}</span>`)
            .join('');

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            <div class="flex items-center gap-2">${badgesHtml}</div>
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

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger:  'var(--cs-danger,#E02424)',
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-400',
                legend: 'flex items-center gap-3 text-[10px] text-gray-400',
                item:   'flex items-center gap-1'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.tones   = Object.assign({}, defaults.tones,   o.tones   || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneColor  = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }
}
