let apiPos = '/app/facture2/ctrl/ctrl-facture2-pos.php';
let app, reimpresion;

$(() => {
    reimpresion = new Reimpresion(apiPos, 'root');
    app         = new App(apiPos, 'root');

    app.init();
});

// -- Clase principal --

class App extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'pos';
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();

        reimpresion.init();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    this.PROJECT_NAME,
                class: 'flex-1 min-h-0 w-full flex flex-col overflow-hidden ws-app',
                container: [
                    {
                        type:  'div',
                        id:    'contentRow',
                        class: 'flex-1 min-h-0 overflow-auto flex justify-center items-stretch p-4'
                    }
                ]
            }
        });
    }
}

// -- Reimpresion --

class Reimpresion extends Templates {

    // -- Initial --

    // Numero de orden y de movimiento no pasan de seis digitos en ningun recibo real
    // de la terminal; es el mismo limite que usa Acceso para su contraseña.
    static get MAX_LEN() { return 6; }

    static get FIELD_IDS() {
        return { orden: 'fOrden', movimiento: 'fMovimiento' };
    }

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME  = 'reimpresion';

        // Como se busca el ticket: por sus numeros o por calendario. Dentro del
        // calendario, si el periodo es un dia suelto o un rango. Son dos preguntas
        // distintas y por eso son dos estados: la segunda solo existe dentro de la
        // primera (ver renderCapturaBox).
        this.mode     = 'ticket';
        this.dateMode = 'dia';

        this.activeField   = 'orden';
        this.orden         = '';
        this.movimiento    = '';
        this.fi            = '';
        this.ff            = '';
        this.emisor        = null;
        this.cols          = [];
        this.currentRecord = null;

        // Lo que se va a reimprimir: movimiento -> importe. Es un Map y no una lista
        // de folios porque la barra tiene que decir cuanto suma lo marcado sin volver
        // a preguntarle a la tabla, que puede estar a medio desplazar.
        this.selected = new Map();
        this.rowCount = 0;
    }

    // -- Interface --

    // El periodo con el que abre la pantalla lo decide el servidor: es el ultimo dia
    // CON papeles emitidos, no hoy. El Excel del POS se sube en diferido y abrir en
    // la fecha del reloj dejaria la pantalla vacia la mayor parte del tiempo.
    async init() {
        const data = await useFetch({ url: apiPos, data: { opc: 'init' } });

        if (!data || data.status !== 200) return this.renderBroken();

        this.fi     = data.fi;
        this.ff     = data.ff;
        this.emisor = data.emisor;

        this.renderReimpresion();
    }

    renderReimpresion() {
        this.frameLayout();
        this.leftColLayout();

        this.renderModeBox();
        this.renderCapturaBox();

        keypad({
            parent: 'keypadCol',
            id:     'keypadReimpresion',
            class:  'ws-keypad ws-keypad-sq grid grid-cols-4 gap-2 w-full max-w-[300px]',
            json:   this.keysJson(),
            onKey:  (key) => this.onKeyPress(key)
        });

        this.renderPreview(null);
    }

    // El marco grande —borde azul delgado, como el formulario Windows Forms del
    // POS— envuelve todo: la fila de captura arriba y la vista previa abajo.
    frameLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'frame',
                class: 'ws-frame w-full max-w-5xl flex flex-col',
                container: [
                    {
                        type:  'div',
                        id:    'topRow',
                        class: 'flex flex-wrap items-start gap-6 p-4',
                        children: [
                            {
                                id:    'leftCol',
                                class: 'flex flex-col gap-4 w-full max-w-[340px]'
                            },
                            {
                                id:    'keypadCol',
                                class: 'flex-1 min-w-[280px] flex items-start justify-end'
                            }
                        ]
                    },
                    {
                        type:  'div',
                        id:    'previewRow',
                        class: 'ws-preview flex-1 min-h-[280px] flex items-start justify-center mx-4 mb-4 p-4 overflow-auto'
                    },
                    // La hoja de reimpresion solo existe para el papel: en pantalla
                    // no se ve y el @media print de facture.css la saca a imprimir.
                    // Vive fuera de #previewRow porque ese hueco se vacia en cada
                    // consulta y se llevaria la hoja a medio trabajo.
                    {
                        type:  'div',
                        id:    'printSheet',
                        class: 'hidden'
                    }
                ]
            }
        });
    }

    leftColLayout() {
        this.createLayout({
            parent: 'leftCol',
            design: false,
            data: {
                id:    'leftColInner',
                class: 'flex flex-col gap-4 w-full',
                container: [
                    {
                        type:  'div',
                        id:    'modeBox',
                        class: 'ws-frame-box p-3'
                    },
                    {
                        type:  'div',
                        id:    'fieldsBox',
                        class: 'ws-frame-box p-3 flex flex-col gap-3'
                    }
                ]
            }
        });
    }

    // Como se busca: por el ticket que el cliente trae en la mano, o por fecha. Son
    // las dos unicas maneras, y el rango no es una tercera —es una forma de la
    // fecha—, por eso no comparte esta fila.
    renderModeBox() {
        const wrap = $('<div>', { class: 'flex items-center gap-6' });

        wrap.append(this.radioField('reimpresionModo', 'modo', 'ticket', 'Ticket', this.mode === 'ticket', (v) => this.onModeChange(v)));
        wrap.append(this.radioField('reimpresionModo', 'modo', 'fecha',  'Fecha',  this.mode === 'fecha',  (v) => this.onModeChange(v)));

        $('#modeBox').empty().append(wrap);
    }

    radioField(name, prefijo, value, text, checked, fn) {
        const label = $('<label>', { class: 'flex items-center gap-2 cursor-pointer select-none' });

        const input = $('<input>', {
            type:  'radio',
            name:  name,
            id:    prefijo + value,
            value: value,
            class: 'ws-radio'
        });

        input.prop('checked', checked);
        input.on('change', () => fn(value));

        label.append(input);
        label.append($('<span>', { class: 'text-[13px]', text: text }));

        return label;
    }

    // La misma cajita sirve a los dos modos: por orden y movimiento, o por
    // calendario. No se apilan las dos capturas ni se deshabilita una, porque el
    // ticket se busca de una manera o de la otra, nunca de las dos a la vez.
    renderCapturaBox() {
        this.dropPicker();

        const box = $('#fieldsBox').empty();

        if (!this.isTicketMode()) {
            box.append(this.dateModeRow());
            box.append(this.dateField());

            this.mountPicker();

            return;
        }

        box.append(this.underlineField('orden',      'Número de Orden:'));
        box.append(this.underlineField('movimiento', 'Movimiento:'));

        this.highlightActiveField();

        $(`#${Reimpresion.FIELD_IDS.orden}`).trigger('focus');
    }

    // La segunda pregunta, que solo existe una vez elegida la busqueda por fecha: un
    // dia suelto o un periodo. Va dentro de la cajita de captura y no arriba con los
    // modos, porque es parte de lo que se captura, no de como se busca.
    dateModeRow() {
        const wrap = $('<div>', { class: 'flex flex-wrap items-center gap-x-5 gap-y-2' });

        wrap.append(this.radioField('reimpresionFecha', 'fecha', 'dia',   'Fecha específica', this.dateMode === 'dia',   (v) => this.onDateModeChange(v)));
        wrap.append(this.radioField('reimpresionFecha', 'fecha', 'rango', 'Rango',            this.dateMode === 'rango', (v) => this.onDateModeChange(v)));

        return wrap;
    }

    underlineField(key, label) {
        const row = $('<div>', { class: 'flex items-center gap-3' });

        row.append($('<label>', {
            class: 'ws-uline-lbl',
            for:   Reimpresion.FIELD_IDS[key],
            text:  label
        }));

        const input = $('<input>', {
            id:           Reimpresion.FIELD_IDS[key],
            type:         'text',
            inputmode:    'numeric',
            autocomplete: 'off',
            maxlength:    Reimpresion.MAX_LEN,
            class:        'ws-uline-field flex-1 min-w-0',
            value:        this[key]
        });

        input.on('focus', () => this.onFieldFocus(key));
        input.on('input', () => this.onFieldInput(key));
        input.on('keydown', (event) => this.onFieldKey(key, event));

        return row.append(input);
    }

    // El campo de fecha va de solo lectura: el dia se elige del calendario, que es lo
    // unico que garantiza un dia con formato de dia. En rango el campo es el mismo
    // —solo cambia la etiqueta— porque lo que se lee ahi es el periodo completo:
    // "20/08/2026 al 22/08/2026".
    dateField() {
        const rango = this.isRange();
        const row   = $('<div>', { class: 'flex items-center gap-3' });

        row.append($('<label>', {
            class: `ws-uline-lbl ${rango ? 'ws-uline-lbl-auto' : ''}`,
            for:   'fFecha',
            text:  rango ? 'Período:' : 'Fecha:'
        }));

        row.append($('<input>', {
            id:       'fFecha',
            type:     'text',
            readonly: true,
            class:    'ws-uline-field ws-uline-active flex-1 min-w-0 cursor-pointer'
        }));

        return row;
    }

    // El calendario del plugin no vive dentro del campo sino colgado del body, asi
    // que vaciar la cajita se lleva el input y deja el popup huerfano. Se retira
    // antes, mientras el input todavia existe y se le puede preguntar por el.
    dropPicker() {
        const picker = $('#fFecha').data('daterangepicker');

        if (picker) picker.remove();
    }

    // type 'simple' => singleDatePicker con autoApply, el mismo que usa el filtro de
    // dia de Ventas. type 'all' => los dos extremos, con los periodos de un toque a
    // un lado del calendario.
    mountPicker() {
        if (this.isRange()) return this.mountRangePicker();

        dataPicker({
            parent:      'fFecha',
            type:        'simple',
            rangeDefault: {
                singleDatePicker: true,
                showDropdowns:    true,
                autoApply:        true,
                startDate:        moment(this.fi),
                locale:           this.pickerLocale()
            },
            onSelect: () => this.onFechaChange()
        });
    }

    // alwaysShowCalendars deja el calendario a la vista junto a los periodos: sin el,
    // elegir un periodo propio obliga a pasar antes por "Personalizar".
    mountRangePicker() {
        dataPicker({
            parent:     'fFecha',
            type:       'all',
            rangepicker: {
                startDate:           moment(this.fi),
                endDate:             moment(this.ff),
                showDropdowns:       true,
                autoApply:           true,
                alwaysShowCalendars: true,
                ranges:              this.pickerRanges(),
                locale:              this.pickerLocale()
            },
            onSelect: () => this.onFechaChange()
        });
    }

    // Los periodos de un toque cuelgan del dia con el que abrio la pantalla —el
    // ultimo con papeles—, no de hoy: contados desde el reloj, "últimos 7 días"
    // puede caer entero en dias sin nada.
    pickerRanges() {
        const ref = moment(this.ff || this.fi);

        return {
            'Último día':     [ref.clone(), ref.clone()],
            'Últimos 3 días': [ref.clone().subtract(2, 'days'), ref.clone()],
            'Últimos 7 días': [ref.clone().subtract(6, 'days'), ref.clone()]
        };
    }

    // El formato es el del recibo —dia/mes/año— y el separador se lee: el campo del
    // periodo dice "20/08/2026 al 22/08/2026", no "20/08/2026 - 22/08/2026".
    pickerLocale() {
        return {
            format:           'DD/MM/YYYY',
            separator:        ' al ',
            applyLabel:       'Aplicar',
            cancelLabel:      'Cancelar',
            customRangeLabel: 'Personalizar',
            monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
        };
    }

    // El 0 arranca en la segunda columna para quedar centrado bajo el 2 y ESC en la
    // cuarta, a su misma altura. Enter es la unica tecla de dos filas: cubre la del
    // 789 y la del 456, como en el boceto.
    keysJson() {
        return [
            { value: 7, label: '7' },
            { value: 8, label: '8' },
            { value: 9, label: '9' },
            {
                value:  'enter',
                label:  'Enter',
                action: true,
                class:  'ws-key-wide'
            },
            { value: 4, label: '4' },
            { value: 5, label: '5' },
            { value: 6, label: '6' },
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            {
                value:  'clr',
                label:  'Borrar',
                action: true
            },
            {
                value: 0,
                label: '0',
                class: 'col-start-2'
            },
            {
                value:  'esc',
                label:  'ESC',
                action: true,
                class:  'col-start-4'
            }
        ];
    }

    // Buscando por calendario no hay nada que teclear —la fecha sale del popup—, asi
    // que los digitos se apagan. El teclado no se quita: es parte de la pantalla del
    // POS, y Enter, Borrar y ESC siguen sirviendo en los dos modos.
    dimKeys() {
        $('#keypadReimpresion .ws-key').not('.ws-key-act').toggleClass('is-off', !this.isTicketMode());
    }

    // -- Vista previa --

    // El hueco se apoya en gris solo cuando sale la tira: es lo que despega el papel
    // blanco del recuadro. Con la lista del periodo —que no es papel— se queda claro,
    // como el resto del formulario.
    renderPreview(json) {
        // is-lista la pone lsTickets cuando ya hay tabla: es la que le pasa el scroll
        // al hueco de los renglones para dejar la barra fija al pie.
        $('#previewRow').toggleClass('ws-preview-mesa', Boolean(json)).removeClass('is-lista');

        this.dimKeys();

        if (json)                 return this.renderTicket(json);

        if (!this.isTicketMode()) return this.lsTickets();

        this.renderEmptyPreview();
    }

    renderEmptyPreview() {
        $('#previewRow').empty().append($('<p>', {
            class: 'ws-preview-empty m-auto',
            text:  'Sin ticket seleccionado'
        }));
    }

    // Mientras el servidor responde. El panel no se queda en blanco ni conserva la
    // consulta anterior, que es lo que haria dudar de si la nueva ya salio.
    renderLoading(texto) {
        $('#previewRow').removeClass('ws-preview-mesa').empty().append($('<p>', {
            class: 'ws-preview-empty m-auto',
            text:  texto
        }));
    }

    // La pantalla no pudo ni arrancar: sin periodo ni emisor no hay nada que
    // capturar, asi que en vez de un formulario que no busca nada se dice que pasa.
    renderBroken() {
        $('#contentRow').empty().append($('<p>', {
            class: 'ws-preview-empty m-auto',
            text:  'No se pudo consultar la información de tickets'
        }));
    }

    // Desde la lista del periodo el papel llega con su regreso: sin el, volver a ver
    // los demas tickets obligaria a elegir otra vez la fecha.
    renderTicket(json) {
        this.createLayout({
            parent: 'previewRow',
            design: false,
            data: {
                id:    'ticketWrap',
                class: 'w-full flex flex-col items-center gap-3',
                container: [
                    {
                        type:  'div',
                        id:    'ticketBack',
                        class: 'w-full'
                    },
                    {
                        type: 'div',
                        id:   'ticketHost'
                    }
                ]
            }
        });

        if (!this.isTicketMode()) this.renderBack();

        TicketPaper.render({
            parent: 'ticketHost',
            json:   json,
            pos:    this.emisor.pos_code,
            emisor: this.emisor
        });
    }

    // La fila de arriba del papel: por donde se vuelve a la lista y por donde se
    // manda ese ticket a la impresora sin tener que marcarlo antes.
    renderBack() {
        const fila = $('<div>', { class: 'flex items-center gap-2' });

        const volver = $('<button>', {
            type:  'button',
            id:    'btnBackLista',
            class: 'ws-act'
        });

        volver.append($('<i>', { 'data-lucide': 'arrow-left', class: 'w-3.5 h-3.5' }));
        volver.append($('<span>', { text: `Tickets del ${this.periodoLabel()}` }));

        volver.on('click', () => this.backToList());

        const imprimir = $('<button>', {
            type:  'button',
            id:    'btnPrintOne',
            class: 'ws-act ml-auto'
        });

        imprimir.append($('<i>', { 'data-lucide': 'printer', class: 'w-3.5 h-3.5' }));
        imprimir.append($('<span>', { text: 'Reimprimir' }));

        imprimir.on('click', () => this.printCurrent());

        fila.append(volver).append(imprimir);

        $('#ticketBack').empty().append(fila);

        lucide.createIcons();
    }

    // -- CRUD --

    // El listado del periodo. Las columnas las manda el servidor: Fecha y Hora solo
    // salen cuando dicen algo —varios dias, ventas con hora— y decidirlo tambien
    // aqui dejaria a la tabla y a las filas discutiendo cuantas columnas hay.
    async lsTickets() {
        this.renderLoading('Consultando tickets…');

        const data = await useFetch({
            url:  apiPos,
            data: { opc: 'lsTickets', fi: this.fi, ff: this.ff }
        });

        if (!data || data.status !== 200) return this.renderLoading('No se pudo consultar el periodo');

        this.cols     = data.thead;
        this.rowCount = data.row.length;

        this.listaLayout();

        this.createCoffeeTable3({
            parent:       'listaWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        WANSOFT_THEME,
            center:       this.centerCols(),
            right:        [this.colIndex('Total')],
            hover:        true,
            f_size:       12,
            emptyMessage: this.isMultiDay() ? 'Sin tickets en el período seleccionado' : 'Sin tickets en el día seleccionado',
            emptyIcon:    'icon-list',
            data: {
                thead: data.thead,
                row:   data.row
            }
        });

        $('#previewRow').addClass('is-lista');

        this.initSelect();
        this.initCheck();

        // La tabla se vuelve a crear cada vez que se regresa del papel, y nace con
        // las casillas vacias: lo marcado se repinta sobre los renglones nuevos.
        this.paintChecks();
        this.renderSelBar();
    }

    // La tabla y la barra de seleccion son hermanas dentro del panel: la barra vive
    // fuera de la tabla para que quede pegada al pie y no se vaya con el scroll de
    // los renglones.
    listaLayout() {
        this.createLayout({
            parent: 'previewRow',
            design: false,
            data: {
                id:    'listaFrame',
                class: 'w-full flex flex-col',
                container: [
                    {
                        type:  'div',
                        id:    'listaWrap',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'selBar',
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    // Los numeros y las fechas van centrados; el mesero es lo unico que se lee como
    // texto y se queda a la izquierda, el total contra el margen derecho. La casilla
    // no lleva titulo, asi que su columna se centra por descarte.
    centerCols() {
        return this.cols
            .map((titulo, i) => (['Mesero', 'Total'].includes(titulo) ? 0 : i + 1))
            .filter(Boolean);
    }

    // 1-based, como los pide createCoffeeTable3.
    colIndex(titulo) {
        return this.cols.indexOf(titulo) + 1;
    }

    // El papel, pedido por los dos numeros que el cajero tiene a la vista. No
    // encontrarlo es un resultado normal de la pantalla —los dos numeros se teclean—
    // y el servidor manda el motivo ya redactado.
    async getTicket(orden, movimiento) {
        this.renderLoading('Buscando el ticket…');

        const data = await useFetch({
            url:  apiPos,
            data: { opc: 'getTicket', orden: orden, movimiento: movimiento }
        });

        if (!data) {
            this.currentRecord = null;
            this.renderPreview(null);

            return this.alertBox({ theme: WANSOFT_THEME, type: 'error', title: 'No se pudo consultar el ticket', timer: 2200 });
        }

        if (data.status !== 200) {
            this.currentRecord = null;
            this.renderPreview(null);

            if (this.isTicketMode()) this.shakeField(Reimpresion.FIELD_IDS.orden);

            return this.alertBox({ theme: WANSOFT_THEME, type: 'warning', title: data.message, timer: 2200 });
        }

        this.currentRecord = data.ticket;
        this.renderPreview(this.currentRecord);
    }

    // -- Complements --

    // Volver de fecha a ticket no se lleva la captura de la fecha: el periodo se
    // conserva para cuando se regrese, que es lo que el cajero espera de una pantalla
    // que ya consulto un dia. Lo marcado si se suelta: en la busqueda por ticket solo
    // hay un papel, y volver con tres seleccionados de antes seria una sorpresa.
    onModeChange(mode) {
        this.mode          = mode;
        this.currentRecord = null;

        this.selected.clear();

        this.renderCapturaBox();
        this.renderPreview(null);
    }

    // Al volver de rango a dia suelto el periodo se cierra sobre su primer dia: dejar
    // el extremo final abierto haria que "Fecha específica" listara varios dias.
    onDateModeChange(dateMode) {
        this.dateMode      = dateMode;
        this.currentRecord = null;

        this.selected.clear();

        if (dateMode === 'dia') this.ff = this.fi;

        this.renderCapturaBox();
        this.renderPreview(null);
    }

    // El picker de dia suelto tambien devuelve dos extremos —iguales entre si—, asi
    // que la lectura es la misma en los dos modos y el resto de la pantalla trabaja
    // siempre con un periodo.
    onFechaChange() {
        const periodo = getDataRangePicker('fFecha');

        this.fi            = periodo.fi;
        this.ff            = this.isRange() ? periodo.ff : periodo.fi;
        this.currentRecord = null;

        // Otro periodo son otros tickets: lo que estaba marcado ya no esta en la
        // lista, y arrastrarlo mandaria a imprimir papeles que no se ven.
        this.selected.clear();

        this.renderPreview(null);
    }

    backToList() {
        this.currentRecord = null;

        this.renderPreview(null);
    }

    onFieldFocus(key) {
        this.activeField = key;
        this.highlightActiveField();
    }

    highlightActiveField() {
        Object.keys(Reimpresion.FIELD_IDS).forEach((key) => {
            $(`#${Reimpresion.FIELD_IDS[key]}`).toggleClass('ws-uline-active', key === this.activeField);
        });
    }

    // this[key] es la unica fuente de verdad; el input solo la refleja, igual que
    // this.pass en Acceso.
    onFieldInput(key) {
        const field = $(`#${Reimpresion.FIELD_IDS[key]}`);

        this[key] = String(field.val()).replace(/\D/g, '').slice(0, Reimpresion.MAX_LEN);

        field.val(this[key]);
    }

    onFieldKey(key, event) {
        if (event.key === 'Enter')  return this.consultar();

        if (event.key === 'Escape') return posGo('inicio');
    }

    onKeyPress(key) {
        if (key.value === 'esc')   return posGo('inicio');

        if (key.value === 'clr')   return this.clear();

        if (key.value === 'enter') return this.consultar();

        if (!this.isTicketMode())  return;

        this.appendDigit(key.value);
    }

    appendDigit(digit) {
        const current = this[this.activeField];

        if (current.length >= Reimpresion.MAX_LEN) return;

        this[this.activeField] = current + String(digit);

        $(`#${Reimpresion.FIELD_IDS[this.activeField]}`).val(this[this.activeField]);
    }

    // Buscando por calendario lo que se borra es la seleccion, que es lo unico
    // capturado.
    clear() {
        if (!this.isTicketMode()) return this.backToList();

        this[this.activeField] = '';

        $(`#${Reimpresion.FIELD_IDS[this.activeField]}`).val('').trigger('focus');
    }

    consultar() {
        if (!this.isTicketMode()) return this.backToList();

        if (!this.orden || !this.movimiento) {
            this.shakeField(Reimpresion.FIELD_IDS[this.activeField]);

            this.alertBox({
                theme: WANSOFT_THEME,
                type:  'warning',
                title: 'Captura el número de orden y el movimiento',
                timer: 1800
            });

            return;
        }

        this.getTicket(this.orden, this.movimiento);
    }

    // La fila entera abre el ticket: en una pantalla tactil un boton de 22px seria el
    // unico punto de toque de un renglon de 35. Las celdas se localizan por el
    // encabezado que mando el servidor, no por posicion fija: la lista no siempre
    // trae las mismas columnas.
    initSelect() {
        const orden      = this.colIndex('Orden') - 1;
        const movimiento = this.colIndex('Movimiento') - 1;

        $(`#tb${this.PROJECT_NAME} tbody tr`).on('click', function () {
            const celdas = $(this).find('td');

            reimpresion.getTicket(celdas.eq(orden).text().trim(), celdas.eq(movimiento).text().trim());
        });
    }

    // -- Seleccion --

    // La casilla marca; el resto de la fila abre el ticket. Son dos gestos sobre el
    // mismo renglon, por eso la casilla corta la propagacion: sin eso, marcar
    // abriria ademas el papel y se perderia de vista la lista que se esta marcando.
    //
    // Se engancha en cada casilla y no por delegacion en la tabla: el clic de la
    // fila vive en el propio <tr> (ver initSelect), asi que un delegado de mas
    // arriba correria DESPUES y su stopPropagation llegaria tarde.
    initCheck() {
        $(`#tb${this.PROJECT_NAME} .ws-chk-all`).on('click', (event) => {
            event.stopPropagation();
            this.toggleAll();
        });

        $(`#tb${this.PROJECT_NAME} tbody .ws-chk`).on('click', (event) => {
            event.stopPropagation();
            this.toggleOne($(event.currentTarget));
        });
    }

    toggleOne(chk) {
        const folio = String(chk.data('folio'));

        if (this.selected.has(folio)) this.selected.delete(folio);
        else                          this.selected.set(folio, Number(chk.data('monto')) || 0);

        this.paintChecks();
        this.renderSelBar();
    }

    // La casilla del encabezado completa la seleccion, y solo la suelta cuando ya
    // estaba entera. Con tres de treinta y seis marcados lo que se quiere es marcar
    // el resto, no perder los tres.
    toggleAll() {
        if (this.selected.size === this.rowCount) this.selected.clear();
        else {
            $(`#tb${this.PROJECT_NAME} tbody .ws-chk`).each((i, el) => {
                const chk = $(el);

                this.selected.set(String(chk.data('folio')), Number(chk.data('monto')) || 0);
            });
        }

        this.paintChecks();
        this.renderSelBar();
    }

    // El estado marcado se pinta en la casilla y en toda la fila: el renglon teñido
    // es lo unico que se lee de un vistazo cuando la lista tiene treinta y seis.
    paintChecks() {
        $(`#tb${this.PROJECT_NAME} tbody .ws-chk`).each((i, el) => {
            const chk = $(el);
            const on  = this.selected.has(String(chk.data('folio')));

            chk.toggleClass('is-on', on);
            chk.closest('tr').toggleClass('is-sel', on);
        });

        // Tres estados en la casilla de arriba: nada, todo, o parte. Sin el estado
        // intermedio, marcar tres de treinta la dejaria diciendo que no hay nada
        // marcado.
        const todos = this.rowCount > 0 && this.selected.size === this.rowCount;

        $(`#tb${this.PROJECT_NAME} .ws-chk-all`)
            .toggleClass('is-on', todos)
            .toggleClass('is-part', this.selected.size > 0 && !todos);
    }

    // La barra solo existe mientras haya algo marcado: vacia seria una franja con
    // dos botones que no pueden hacer nada.
    renderSelBar() {
        const bar = $('#selBar').empty();

        if (!this.selected.size) return;

        const total = [...this.selected.values()].reduce((suma, monto) => suma + monto, 0);
        const wrap  = $('<div>', { class: 'ws-selbar' });

        const cuenta = $('<span>', { class: 'ws-selbar-count' });

        cuenta.append($('<b>', { text: this.ticketsLabel(this.selected.size) }));
        cuenta.append($('<span>', { class: 'ws-selbar-amount', text: ` · ${this.money(total)}` }));

        const btns = $('<span>', { class: 'ws-selbar-btns' });

        const limpiar = $('<button>', { type: 'button', class: 'ws-act', text: 'Quitar selección' });
        limpiar.on('click', () => this.clearSelection());

        const imprimir = $('<button>', { type: 'button', class: 'ws-btn ws-btn-print', text: `Reimprimir ${this.selected.size}` });
        imprimir.on('click', () => this.reimprimir());

        wrap.append(cuenta);
        wrap.append(btns.append(limpiar).append(imprimir));

        bar.append(wrap);
    }

    ticketsLabel(n) {
        return n === 1 ? '1 ticket seleccionado' : `${n} tickets seleccionados`;
    }

    money(monto) {
        return `$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    clearSelection() {
        this.selected.clear();

        this.paintChecks();
        this.renderSelBar();
    }

    // -- Reimpresion --

    // Los papeles se piden armados al servidor —uno o treinta, el mismo camino— y se
    // pintan en la hoja que el @media print saca a imprimir. La clase del body le
    // dice a esa hoja que este es el trabajo, y se retira al cerrar el dialogo.
    async reimprimir() {
        if (!this.selected.size) return;

        const folios = [...this.selected.keys()];

        const data = await useFetch({
            url:  apiPos,
            data: { opc: 'getTickets', folios: folios.join(',') }
        });

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'error',
                title: (data && data.message) || 'No se pudieron preparar los tickets',
                timer: 2400
            });
        }

        this.printPapers(data.tickets, data.emisor);
    }

    // El ticket que se esta viendo, sin pasar por la seleccion: ya se pidio al
    // servidor y esta completo, asi que se manda tal cual.
    printCurrent() {
        if (!this.currentRecord) return;

        this.printPapers([this.currentRecord], this.emisor);
    }

    printPapers(tickets, emisor) {
        const host = $('#printSheet').empty();

        tickets.forEach((ticket, i) => {
            host.append($('<div>', { id: `printTicket${i}` }));

            TicketPaper.render({
                parent: `printTicket${i}`,
                id:     `paperTicket${i}`,
                json:   ticket,
                pos:    emisor.pos_code,
                emisor: emisor
            });
        });

        $('body').addClass('printing-sheet');
        window.print();
        $('body').removeClass('printing-sheet');
    }

    isTicketMode() {
        return this.mode === 'ticket';
    }

    isRange() {
        return this.dateMode === 'rango';
    }

    isMultiDay() {
        return this.fi !== this.ff;
    }

    // Lo que rotula el regreso desde el papel: un dia se nombra solo, un periodo con
    // sus dos extremos, tal como se leen en el campo de captura.
    periodoLabel() {
        return this.isMultiDay()
            ? `${this.fmtFecha(this.fi)} al ${this.fmtFecha(this.ff)}`
            : this.fmtFecha(this.fi);
    }

    fmtFecha(fecha) {
        return moment(fecha).format('DD/MM/YYYY');
    }

    shakeField(id) {
        const field = $(`#${id}`);

        field.removeClass('ws-shake');

        // Entre quitar y poner la clase hace falta forzar un reflow: sin el, un
        // segundo intento seguido no vuelve a arrancar la animacion.
        void field[0].offsetWidth;

        field.addClass('ws-shake');
    }
}
