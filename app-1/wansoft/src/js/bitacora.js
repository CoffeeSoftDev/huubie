let apiBitacora = '/app/wansoft/ctrl/ctrl-facture2-bitacora.php';
let app, bitacora;

$(() => {
    bitacora = new Bitacora(apiBitacora, 'root');
    app      = new App(apiBitacora, 'root');

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

        bitacora.init();
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
                        class: 'flex-1 min-h-0 flex flex-col overflow-hidden'
                    }
                ]
            }
        });
    }
}

// -- Bitacora --

class Bitacora extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'bitacora';

        this.fi       = '';
        this.ff       = '';
        this.usuarios = [];
        this.acciones = [];

        // El renglon cuyo detalle se pidio al ultimo: una respuesta lenta de otro
        // renglon no debe pisar el panel del que se abrio despues.
        this.registroActual = null;
    }

    // -- Interface --

    async init() {
        const data = await useFetch({ url: apiBitacora, data: { opc: 'init' } });

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'error',
                title: 'No se pudo abrir la bitácora',
                timer: 2200
            });
        }

        this.usuarios = data.usuarios;
        this.acciones = data.acciones;
        this.fi       = data.periodo.fi;
        this.ff       = data.periodo.ff;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();

        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: 'contentRow',
            id:     this.PROJECT_NAME,
            class:  'flex flex-1 min-h-0 w-full',
            card: {
                class: 'flex flex-col flex-1 min-w-0 min-h-0',
                filterBar: {
                    class: 'w-full shrink-0 px-4 py-3 bg-white border-b border-gray-200',
                    id:    `filterBar${this.PROJECT_NAME}`
                },
                container: {
                    class: 'w-full flex-1 min-h-0 flex',
                    id:    `container${this.PROJECT_NAME}`
                }
            }
        });

        this.contentLayout();
    }

    // La lista a la izquierda y, a la derecha, el panel que cuenta el renglon elegido:
    // el antes y el despues de lo que cambio, o el resumen de la accion.
    contentLayout() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    'bitacoraWrap',
                class: 'flex-1 min-h-0 w-full flex',
                container: [
                    {
                        type:  'div',
                        id:    'listaRow',
                        class: 'flex-1 min-w-0 px-3 py-2 overflow-auto ws-scroll',
                        children: [
                            {
                                id:    'tablaRow',
                                class: 'w-full'
                            },
                            {
                                id:    'notaRow',
                                class: 'w-full pt-2 text-[11.5px] text-gray-500'
                            }
                        ]
                    },
                    {
                        type:  'div',
                        id:    'detalleRow',
                        class: 'w-[340px] shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col',
                        children: [
                            {
                                id:    'detalleTitulo',
                                class: 'shrink-0 px-3 py-2 bg-white border-b border-gray-200 text-[12.5px] font-semibold',
                                text:  'Detalle'
                            },
                            {
                                id:    'detalleCuerpo',
                                class: 'flex-1 overflow-auto ws-scroll p-3 text-[12.5px]'
                            }
                        ]
                    }
                ]
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      WANSOFT_THEME,
            data: [
                {
                    opc:      'input',
                    id:       'fDesde',
                    lbl:      'Desde',
                    type:     'date',
                    tipo:     'fecha',
                    class:    'col-12 col-sm-6 col-md-3',
                    value:    this.fi,
                    required: false,
                    onchange: 'bitacora.ls()'
                },
                {
                    opc:      'input',
                    id:       'fHasta',
                    lbl:      'Hasta',
                    type:     'date',
                    tipo:     'fecha',
                    class:    'col-12 col-sm-6 col-md-3',
                    value:    this.ff,
                    required: false,
                    onchange: 'bitacora.ls()'
                },
                {
                    opc:      'select',
                    id:       'fUsuario',
                    lbl:      'Usuario',
                    class:    'col-12 col-sm-6 col-md-3',
                    value:    '',
                    required: false,
                    onchange: 'bitacora.ls()',
                    data:     this.usuarios
                },
                {
                    opc:      'select',
                    id:       'fAccion',
                    lbl:      'Acción',
                    class:    'col-12 col-sm-6 col-md-3',
                    value:    '',
                    required: false,
                    onchange: 'bitacora.ls()',
                    data:     this.acciones
                }
            ]
        });
    }

    // El panel de detalle de un renglon. El servidor lo manda ya escrito —etiquetas,
    // montos con formato, fechas—, asi que aqui solo se acomoda; y se pinta con
    // .text(), nunca como HTML: el rotulo puede traer lo que alguien tecleo.
    renderRegistro(registro) {
        const cuerpo = $('#detalleCuerpo').empty();

        if (!registro) {
            cuerpo.append($('<p>', { class: 'text-center text-gray-500 mt-8', text: 'Elige un renglón' }));

            return;
        }

        const accion = String(registro.accion).replace(/[^a-z]/g, '');

        cuerpo.append($('<span>', { class: `ws-accion ws-accion-${accion}`, text: registro.accionTexto }));
        cuerpo.append($('<p>', { class: 'mt-2 mb-0 font-semibold', text: registro.label }));
        cuerpo.append($('<p>', { class: 'm-0 text-[11.5px] text-gray-500', text: `${registro.fechaTexto} · ${registro.usuario}` }));

        registro.cambios.forEach((cambio) => cuerpo.append(this.cambioItem(cambio)));

        if (registro.pares.length) cuerpo.append(this.paresTable(registro.pares));
    }

    // Lo que cambio de UN campo: el valor de antes tachado y el de despues en firme. En
    // un alta el antes es una raya, porque no habia nada.
    cambioItem(cambio) {
        const item    = $('<div>', { class: 'mt-3' });
        const valores = $('<div>', { class: 'mt-1' });

        item.append($('<div>', { class: 'text-[11px] text-gray-500 uppercase tracking-wider', text: cambio.campo }));

        valores.append($('<span>', { class: 'ws-antes', text: cambio.antes }));
        valores.append(document.createTextNode(' → '));
        valores.append($('<span>', { class: 'ws-despues', text: cambio.despues }));

        return item.append(valores);
    }

    // El resumen de una accion: una fila por dato, con la etiqueta a un lado y el valor
    // contra el margen.
    paresTable(pares) {
        const tabla = $('<table>', { class: 'w-full mt-3 text-[12.5px]' });

        pares.forEach(([etiqueta, valor]) => {
            const fila = $('<tr>');

            fila.append($('<td>', { class: 'py-1.5 pr-3 border-b border-gray-200 align-top text-gray-500', text: etiqueta }));
            fila.append($('<td>', { class: 'py-1.5 border-b border-gray-200 text-right font-medium tabular-nums', text: valor }));

            tabla.append(fila);
        });

        return tabla;
    }

    // -- CRUD --

    async ls() {
        const data = await useFetch({
            url:  apiBitacora,
            data: Object.assign({ opc: 'lsBitacora' }, this.getFilters())
        });

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'warning',
                title: data ? data.message : 'No se pudo consultar la bitácora',
                timer: 2200
            });
        }

        this.createCoffeeTable3({
            parent:       'tablaRow',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        WANSOFT_THEME,
            extends:      true,
            scrollable:   false,
            hover:        true,
            f_size:       12,
            emptyMessage: 'Sin movimientos en el período seleccionado',
            emptyIcon:    'icon-list',
            data:         data
        });

        $('#notaRow').text(data.recortado
            ? `Se muestran los ${data.limite.toLocaleString('es-MX')} movimientos más recientes. Acota el período para ver los anteriores.`
            : '');

        const filas = $(`#tb${this.PROJECT_NAME} tbody tr`);

        filas.on('click', (event) => this.onRowClick($(event.currentTarget)));

        if (filas.length) this.onRowClick(filas.first());
        else              this.renderRegistro(null);
    }

    async getRegistro(id) {
        this.registroActual = id;

        const data = await useFetch({
            url:  apiBitacora,
            data: { opc: 'getRegistro', id: id }
        });

        if (id !== this.registroActual) return;

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'warning',
                title: data ? data.message : 'No se pudo consultar el registro',
                timer: 2200
            });
        }

        this.renderRegistro(data.registro);
    }

    // -- Complements --

    // Los cuatro filtros viajan siempre, aunque esten en blanco: el servidor los lee
    // sin preguntar si existen, y "Todos" es la cadena vacia.
    getFilters() {
        return {
            fi:      $('#fDesde').val(),
            ff:      $('#fHasta').val(),
            usuario: $('#fUsuario').val() || '',
            accion:  $('#fAccion').val() || ''
        };
    }

    // El renglon elegido se marca y pide su detalle. El id viaja en la celda de la
    // fecha (data-log) porque createCoffeeTable3 no lo expone en el <tr>.
    onRowClick(fila) {
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('is-sel');

        fila.addClass('is-sel');

        this.getRegistro(fila.find('[data-log]').first().data('log'));
    }
}
