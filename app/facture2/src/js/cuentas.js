let apiPos = '/app/facture2/ctrl/ctrl-facture2-pos.php';
let app, cuentas;

// Cuentas de muestra. El modulo esta en fase maqueta: no hay ctrl ni mdl todavia,
// asi que la tabla se alimenta de aqui. Trae los campos completos de una cuenta
// abierta —no una version reducida— para que al conectar el backend el contrato
// de columnas ya sea el definitivo (TRM-012).
const SAMPLE_CUENTAS = [
    {
        folio:    'C-1042',
        mesa:     'M-04',
        personas: 4,
        mesero:   'Luis Ramos',
        apertura: '10:12',
        consumo:  '1,284.00',
        estado:   'abierta'
    },
    {
        folio:    'C-1043',
        mesa:     'M-11',
        personas: 2,
        mesero:   'Ana Trejo',
        apertura: '10:26',
        consumo:  '612.50',
        estado:   'impresa'
    },
    {
        folio:    'C-1044',
        mesa:     'B-02',
        personas: 1,
        mesero:   'Luis Ramos',
        apertura: '10:41',
        consumo:  '188.00',
        estado:   'abierta'
    },
    {
        folio:    'C-1045',
        mesa:     'M-07',
        personas: 6,
        mesero:   'Sergio Paz',
        apertura: '10:55',
        consumo:  '2,410.00',
        estado:   'porcobrar'
    },
    {
        folio:    'C-1046',
        mesa:     'T-01',
        personas: 3,
        mesero:   'Ana Trejo',
        apertura: '11:03',
        consumo:  '947.20',
        estado:   'cobrada'
    },
    {
        folio:    'C-1047',
        mesa:     'M-09',
        personas: 2,
        mesero:   'Sergio Paz',
        apertura: '11:18',
        consumo:  '505.00',
        estado:   'porcobrar'
    }
];

$(() => {
    cuentas = new Cuentas(apiPos, 'root');
    app     = new App(apiPos, 'root');

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
        this.filterBar();

        cuentas.lsCuentas();
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
                        id:    'filterBar',
                        class: 'ws-band ws-band-line flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'contentRow',
                        class: 'flex-1 min-h-0 overflow-auto px-3 pt-4'
                    },
                    {
                        type:  'div',
                        id:    'footerRow',
                        class: 'flex-shrink-0 flex items-center justify-center gap-3 py-3'
                    }
                ]
            }
        });
    }

    filterBar() {
        posToolbar({
            parent:    'filterBar',
            id:        `filterBar${this.PROJECT_NAME}`,
            json:      this.toolbarJson(),
            dots:      this.dotsJson(),
            dotsLabel: 'Filtros',
            onDot:     (dot) => this.onDotChange(dot)
        });
    }

    toolbarJson() {
        return [
            {
                id:     'tbOpciones',
                icon:   'menu',
                label:  'Opciones',
                circle: false,
                group:  'left',
                fn:     () => posGo('inicio')
            },
            {
                id:    'tbEditar',
                icon:  'pencil',
                label: 'Editar',
                group: 'left',
                fn:    () => cuentas.editCuenta()
            },
            {
                id:    'tbImprimir',
                icon:  'printer',
                label: 'Imprimir',
                group: 'left',
                fn:    () => cuentas.printCuenta()
            },
            {
                id:    'tbCobrar',
                icon:  'dollar-sign',
                label: 'Cobrar',
                group: 'left',
                fn:    () => cuentas.chargeCuenta()
            },
            {
                id:        'tbFiltro',
                icon:      'filter',
                circle:    false,
                iconClass: 'w-5 h-5 ml-4',
                group:     'left',
                fn:        () => this.clearFilters()
            },
            {
                id:    'tbNueva',
                icon:  'file-plus-2',
                label: 'Nueva',
                group: 'right',
                fn:    () => cuentas.addCuenta()
            },
            {
                id:    'tbActualizar',
                icon:  'refresh-cw',
                label: 'Actualizar',
                group: 'right',
                fn:    () => cuentas.lsCuentas()
            },
            {
                id:    'tbAdmon',
                icon:  'settings',
                label: 'Admon',
                group: 'right',
                fn:    () => posGo('admin')
            },
            {
                id:    'tbBloquear',
                icon:  'lock',
                label: 'Bloquear',
                group: 'right',
                fn:    () => posGo('acceso')
            }
        ];
    }

    // Los cuatro puntos de color del boceto. Cada uno filtra por estado de cuenta:
    // el color de la terminal ya significa eso, aqui solo se le pone nombre.
    dotsJson() {
        return [
            {
                id:    'porcobrar',
                label: 'Por cobrar',
                class: 'ws-dot-red'
            },
            {
                id:    'cobrada',
                label: 'Cobrada',
                class: 'ws-dot-green'
            },
            {
                id:    'impresa',
                label: 'Impresa',
                class: 'ws-dot-yellow'
            },
            {
                id:    'abierta',
                label: 'Abierta',
                class: 'ws-dot-cyan'
            }
        ];
    }

    getFilters() {
        return {
            estado: $(`#filterBar${this.PROJECT_NAME}Dots .ws-dot.is-on`).data('dot') || ''
        };
    }

    // -- Event handlers --

    // Tocar el punto ya activo lo apaga: es la unica forma de volver a "todas" sin
    // un boton de limpiar filtros, que la barra no tiene.
    onDotChange(dot) {
        const point = $(`#filterBar${this.PROJECT_NAME}_${dot.id}`);
        const on    = point.hasClass('is-on');

        $(`#filterBar${this.PROJECT_NAME}Dots .ws-dot`).removeClass('is-on');

        point.toggleClass('is-on', !on);

        cuentas.lsCuentas();
    }

    clearFilters() {
        $(`#filterBar${this.PROJECT_NAME}Dots .ws-dot`).removeClass('is-on');

        cuentas.lsCuentas();
    }

    // -- Complements --

    emptyMessage() {
        return this.getFilters().estado ? 'Ninguna cuenta en ese estado' : 'Sin registros que mostrar';
    }
}

// -- Cuentas --

class Cuentas extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cuentas';
        this.selected     = null;
    }

    // -- Interface --

    // Pie del boceto: el aviso de la izquierda y el paginador. Los botones nacen
    // deshabilitados mientras haya una sola pagina, para que no prometan un salto
    // que no existe.
    renderPager(rows) {
        const wrap = $('<div>', { class: 'flex items-center gap-4' });

        wrap.append($('<span>', {
            class: 'ws-pager',
            text:  rows.length ? `${rows.length} cuenta(s) en pantalla` : app.emptyMessage()
        }));

        wrap.append(this.pagerBtn('pagerPrev', 'chevron-left'));

        wrap.append($('<span>', {
            class: 'ws-pager',
            text:  `Pág. ${rows.length ? 1 : 0} de ${rows.length ? 1 : 0}`
        }));

        wrap.append(this.pagerBtn('pagerNext', 'chevron-right'));

        $('#footerRow').empty().append(wrap);

        lucide.createIcons();
    }

    pagerBtn(id, icon) {
        const btn = $('<button>', {
            type:     'button',
            id:       id,
            class:    'ws-pager-btn',
            disabled: true
        });

        btn.append($('<i>', {
            'data-lucide': icon,
            class:         'w-4 h-4'
        }));

        return btn;
    }

    // -- CRUD --

    lsCuentas() {
        const rows = this.getRows();

        this.selected = null;

        this.createCoffeeTable3({
            parent:       'contentRow',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        WANSOFT_THEME,
            center:       [2, 3, 5, 7],
            right:        [6],
            hover:        true,
            f_size:       12,
            emptyMessage: app.emptyMessage(),
            emptyIcon:    'icon-list',
            data: {
                thead: ['Folio', 'Mesa', 'Personas', 'Mesero', 'Apertura', 'Consumo', 'Estado'],
                row:   rows
            }
        });

        this.renderPager(rows);

        this.initSelect();
    }

    getRows() {
        const filters = app.getFilters();

        return SAMPLE_CUENTAS
            .filter((cuenta) => !filters.estado || cuenta.estado === filters.estado)
            .map((cuenta) => ({
                id:       cuenta.folio,
                folio:    cuenta.folio,
                mesa:     cuenta.mesa,
                personas: cuenta.personas,
                mesero:   cuenta.mesero,
                apertura: cuenta.apertura,
                consumo:  cuenta.consumo,
                estado:   this.estadoLabel(cuenta.estado)
            }));
    }

    addCuenta() {
        posPending('Abrir cuenta nueva');
    }

    editCuenta() {
        if (!this.selected) return this.needSelection();

        posPending(`Editar la cuenta ${this.selected}`);
    }

    printCuenta() {
        if (!this.selected) return this.needSelection();

        posPending(`Imprimir la cuenta ${this.selected}`);
    }

    chargeCuenta() {
        if (!this.selected) return this.needSelection();

        posPending(`Cobrar la cuenta ${this.selected}`);
    }

    // -- Complements --

    initSelect() {
        $(`#tb${this.PROJECT_NAME} tbody tr`).on('click', function () {
            const row = $(this);

            $(`#tb${cuentas.PROJECT_NAME} tbody tr`).removeClass('bg-gray-100');
            row.addClass('bg-gray-100');

            cuentas.selected = row.find('td').first().text().trim();

            $('#navMesas').text(`MESA(S): ${row.find('td').eq(1).text().trim()}`);
        });
    }

    estadoLabel(estado) {
        const labels = {
            abierta:   'Abierta',
            impresa:   'Impresa',
            porcobrar: 'Por cobrar',
            cobrada:   'Cobrada'
        };

        return labels[estado] || estado;
    }

    needSelection() {
        this.alertBox({
            theme: WANSOFT_THEME,
            type:  'warning',
            title: 'Selecciona primero una cuenta',
            timer: 1600
        });
    }
}
