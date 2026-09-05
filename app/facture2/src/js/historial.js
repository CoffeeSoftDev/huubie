let apiHistorial = '/app/facture/ctrl/ctrl-facture-historial.php';
let app, historial;

$(() => {
    historial = new Historial(apiHistorial, 'root');
    app       = new App(apiHistorial, 'root');

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

        historial.init();
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
                        class: 'flex-1 min-h-0 overflow-auto flex justify-center items-start p-4'
                    }
                ]
            }
        });
    }
}

// -- Historial --

class Historial extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'historial';

        this.fi    = '';
        this.ff    = '';
        this.tipos = [];
    }

    // -- Interface --

    async init() {
        const data = await useFetch({ url: apiHistorial, data: { opc: 'init' } });

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'error',
                title: 'No se pudo abrir el registro de generación',
                timer: 2200
            });
        }

        this.tipos = data.tipos;
        this.fi    = data.periodo.fi;
        this.ff    = data.periodo.ff;

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
            class:  'w-full max-w-6xl p-2',
            card: {
                filterBar: {
                    class: 'w-full mb-3',
                    id:    `filterBar${this.PROJECT_NAME}`
                },
                container: {
                    class: 'w-full my-3 h-full',
                    id:    `container${this.PROJECT_NAME}`
                }
            }
        });

        this.contentLayout();
    }

    contentLayout() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    'historialWrap',
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        id:    'resumenRow',
                        class: 'w-full mb-4'
                    },
                    {
                        type:  'div',
                        id:    'tablaRow',
                        class: 'w-full'
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
                    opc:   'input-calendar',
                    id:    `calendar${this.PROJECT_NAME}`,
                    lbl:   'Período:',
                    class: 'col-12 col-md-6'
                },
                {
                    opc:      'select',
                    id:       'fTipo',
                    lbl:      'Tipo de generación:',
                    class:    'col-12 col-md-6',
                    value:    '',
                    required: false,
                    onchange: 'historial.ls()',
                    data:     this.tipos
                }
            ]
        });

        this.mountPicker();
    }

    // Los periodos de un toque cuelgan del dia con el que abrio la pantalla, no del
    // reloj: el Excel del POS se sube en diferido y contar desde hoy puede caer
    // entero en dias que nadie ha generado.
    mountPicker() {
        dataPicker({
            parent: `calendar${this.PROJECT_NAME}`,
            type:   'all',
            rangepicker: {
                startDate:           moment(this.fi),
                endDate:             moment(this.ff),
                showDropdowns:       true,
                autoApply:           true,
                alwaysShowCalendars: true,
                ranges:              this.pickerRanges(),
                locale:              this.pickerLocale()
            },
            onSelect: () => this.ls()
        });
    }

    pickerRanges() {
        const ref = moment(this.ff);

        return {
            'Último día':      [ref.clone(), ref.clone()],
            'Últimos 7 días':  [ref.clone().subtract(6, 'days'), ref.clone()],
            'Últimos 30 días': [ref.clone().subtract(29, 'days'), ref.clone()],
            'Mes actual':      [moment().startOf('month'), moment()],
            'Mes anterior':    [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        };
    }

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

    getFilters() {
        const rango = getDataRangePicker(`calendar${this.PROJECT_NAME}`);

        this.fi = rango.fi;
        this.ff = rango.ff;

        return {
            fi:   this.fi,
            ff:   this.ff,
            kind: $('#fTipo').val() || ''
        };
    }

    async ls() {
        const data = await useFetch({
            url:  apiHistorial,
            data: Object.assign({ opc: 'lsHistorial' }, this.getFilters())
        });

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'error',
                title: 'No se pudo consultar el período',
                timer: 2200
            });
        }

        this.renderResumen(data.resumen);

        this.createCoffeeTable3({
            parent:       'tablaRow',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        WANSOFT_THEME,
            center:       [2, 3, 5, 7],
            right:        [6],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            hover:        true,
            f_size:       12,
            emptyMessage: 'Sin generaciones en el período seleccionado',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        if (typeof simple_data_table === 'function') simple_data_table(`#tb${this.PROJECT_NAME}`, 15);
    }

    // Lo que el periodo ejecuto. Las cifras suman las columnas congeladas de cada
    // corrida, no las ventas del dia: una venta que nunca entro a una generacion no
    // aparece aqui, y esa diferencia es justamente lo que se audita.
    renderResumen(r) {
        const card = (id, title, lucideIcon, value, subtitle, color) => ({
            id,
            title,
            lucideIcon,
            bgColor:     'bg-white',
            borderColor: 'border-gray-200',
            data: {
                value:    value,
                subtitle: subtitle,
                color:    color
            }
        });

        this.infoCard({
            parent: 'resumenRow',
            id:     'kpisHistorial',
            theme:  WANSOFT_THEME,
            style:  'file',
            cols:   5,
            json: [
                card('kpiCorridas', 'Generaciones', 'history', String(r.corridas),
                     `${r.movimientos} movimientos`, 'text-gray-900'),

                card('kpiTotal', 'Total tarjeta', 'credit-card', r.totalTexto,
                     'suma de las corridas del período', 'text-gray-900'),

                card('kpiMonto16', 'Monto 16%', 'receipt', r.monto16Texto,
                     'lo que se repartió al 16%', 'text-[#2340BC]'),

                card('kpiMonto0', 'Monto 0%', 'receipt', r.monto0Texto,
                     'lo que se repartió al 0%', 'text-amber-600'),

                card('kpiReasignados', 'Folios reasignados', 'shuffle', String(r.reasignados),
                     `${r.ceros} ticket(s) de $0.00`, 'text-gray-900')
            ]
        });

        if (window.lucide) lucide.createIcons();
    }

    async getGeneracion(id) {
        const data = await useFetch({
            url:  apiHistorial,
            data: { opc: 'getGeneracion', id: id }
        });

        if (!data || data.status !== 200) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'warning',
                title: data ? data.message : 'No se pudo consultar el registro',
                timer: 2200
            });
        }

        this.renderFicha(data.ficha);
    }

    // Los once datos del punto 29 de una sola ejecucion. Todos llegan escritos del
    // servidor; aqui solo se acomodan en renglones.
    //
    // Los montos que llegan vacios son los de una corrida que no reparte el dia: se
    // pintan con una raya, que se lee "no aplica", y no en $0.00, que se leeria como
    // que no se facturo nada.
    renderFicha(f) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const dato = (etiqueta, valor) => `
            <span class="block flex items-baseline justify-between gap-3 py-0.5">
                <span class="text-gray-500">${esc(etiqueta)}</span>
                <span class="text-gray-900 font-semibold text-right">${valor ? esc(valor) : '&mdash;'}</span>
            </span>
        `;

        const monto = (etiqueta, valor) => `
            <span class="block flex items-baseline justify-between gap-3 py-0.5">
                <span class="text-gray-500">${esc(etiqueta)}</span>
                <span class="font-mono text-gray-900 font-semibold whitespace-nowrap">${valor ? esc(valor) : '&mdash;'}</span>
            </span>
        `;

        const separador = '<span class="block border-t border-gray-200 my-2.5"></span>';

        this.alertBox({
            theme:   WANSOFT_THEME,
            type:    'info',
            title:   f.folio,
            width:   'w-[430px]',
            timer:   0,
            okLabel: 'Cerrar',
            detailHtml: `
                <span class="block text-left text-gray-500 text-[11px]">${esc(f.tipo)} · ${esc(f.fechaTexto)}</span>
                ${separador}
                ${dato('Usuario', f.usuario)}
                ${dato('Archivo origen', f.archivo)}
                ${dato('Movimientos', f.movimientos)}
                ${separador}
                ${monto('Total tarjeta', f.totalTexto)}
                ${monto('Monto 16%', f.monto16Texto)}
                ${monto('Monto 0%', f.monto0Texto)}
                ${f.metaTexto ? dato('Meta aplicada', f.metaTexto) : ''}
                ${f.corteTexto ? dato('Folio de corte', f.corteTexto) : ''}
                ${separador}
                ${dato('Número de Tickets', f.tickets)}
                ${dato('Folios reasignados', f.reasignados)}
                ${dato('Tickets de $0.00', f.ceros)}
                ${f.sinPapel ? dato('Ventas sin papel', f.sinPapel) : ''}
                ${separador}
                ${dato('Creado', f.creadoTexto)}
            `
        });
    }
}
