let apiPos = '/app/facture2/ctrl/ctrl-facture2-pos.php';
let app, acceso, inicio, cuentas, admin;

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
    acceso  = new Acceso(apiPos, 'root');
    inicio  = new Inicio(apiPos, 'root');
    cuentas = new Cuentas(apiPos, 'root');
    admin   = new Admin(apiPos, 'root');
    app     = new App(apiPos, 'root');

    app.init();
});

// -- Clase principal --

class App extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'pos';
        this.view         = 'acceso';
        this.previous     = 'inicio';
        this.estado       = '';
    }

    get filters() {
        return { estado: this.estado };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();

        // La pantalla de acceso no lleva banda de datos: en el boceto la terminal
        // solo se identifica despues de entrar. Y en el menu de administracion el
        // rotulo de usuario cede su lugar al nombre de la seccion.
        $('#menu-navbar').toggle(this.view !== 'acceso');

        $('#navUsuario').text(this.view === 'admin' ? 'Administración' : `Usuario: ${WANSOFT_TERMINAL.usuario}`);

        if (this.view === 'acceso') return acceso.renderAcceso();

        if (this.view === 'inicio') return inicio.renderInicio();

        if (this.view === 'admin') return admin.renderMenu();

        this.filterBar();

        cuentas.lsCuentas();
    }

    layout() {
        const bands = [];

        // Solo la vista de cuentas tiene barra de acciones y pie de paginacion.
        // Las otras dos no las declaran para no dejar bandas vacias.
        if (this.view === 'cuentas') {
            bands.push({
                id:    'filterBar',
                class: 'ws-band ws-band-line flex-shrink-0'
            });
        }

        bands.push({
            id:    'contentRow',
            class: this.contentClass()
        });

        if (this.view === 'cuentas') {
            bands.push({
                id:    'footerRow',
                class: 'flex-shrink-0 flex items-center justify-center gap-3 py-3'
            });
        }

        if (this.view === 'acceso') {
            bands.push({
                id:    'brandRow',
                class: 'ws-band flex-shrink-0 flex flex-col items-center justify-center gap-6 py-6'
            });
        }

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col overflow-hidden ws-app',
                container: bands
            }
        });
    }

    contentClass() {
        if (this.view === 'acceso') return 'flex-1 min-h-0 flex flex-col items-center justify-center gap-5';

        if (this.view === 'inicio' || this.view === 'admin') return 'flex-1 min-h-0 overflow-auto flex justify-center pt-12 px-6';

        return 'flex-1 min-h-0 overflow-auto px-3 pt-4';
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
                fn:     () => this.go('inicio')
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
                fn:        () => this.onDotChange({ id: '' })
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
                fn:    () => this.go('admin')
            },
            {
                id:    'tbBloquear',
                icon:  'lock',
                label: 'Bloquear',
                group: 'right',
                fn:    () => this.go('acceso')
            }
        ];
    }

    // Los cuatro puntos de color del boceto. Cada uno filtra por estado de cuenta:
    // el color de la terminal ya significa eso, aqui solo se le pone nombre.
    dotsJson() {
        return [
            {
                id:     'porcobrar',
                label:  'Por cobrar',
                class:  'ws-dot-red',
                active: this.estado === 'porcobrar'
            },
            {
                id:     'cobrada',
                label:  'Cobrada',
                class:  'ws-dot-green',
                active: this.estado === 'cobrada'
            },
            {
                id:     'impresa',
                label:  'Impresa',
                class:  'ws-dot-yellow',
                active: this.estado === 'impresa'
            },
            {
                id:     'abierta',
                label:  'Abierta',
                class:  'ws-dot-cyan',
                active: this.estado === 'abierta'
            }
        ];
    }

    // -- Complements --

    go(view) {
        this.previous = this.view;
        this.view     = view;

        this.render();
    }

    // Al menu de administracion se llega desde el inicio y desde el listado de
    // cuentas: regresar tiene que devolver a la que se estaba viendo, no a una
    // fija. La pantalla de acceso nunca es destino de regreso.
    back() {
        this.go(this.previous === 'acceso' ? 'inicio' : this.previous);
    }

    // Tocar el punto ya activo lo apaga: es la unica forma de volver a "todas" sin
    // un boton de limpiar filtros, que la barra no tiene.
    onDotChange(dot) {
        this.estado = this.estado === dot.id ? '' : dot.id;

        this.render();
    }

    emptyMessage() {
        return this.estado ? 'Ninguna cuenta en ese estado' : 'Sin registros que mostrar';
    }
}

// -- Acceso --

class Acceso extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'acceso';
        this.pass         = '';
    }

    // -- Interface --

    renderAcceso() {
        this.pass = '';

        this.accessLayout();

        this.renderField();

        keypad({
            parent: 'keypadRow',
            id:     'keypadAcceso',
            json:   this.keysJson(),
            onKey:  (key) => this.onKeyPress(key)
        });

        this.renderActions();
        this.renderBrand();
    }

    accessLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'accessWrap',
                class: 'flex flex-col items-center gap-4',
                container: [
                    {
                        type:  'div',
                        id:    'fieldRow',
                        class: 'w-[300px]'
                    },
                    {
                        type:  'div',
                        id:    'keypadRow'
                    },
                    {
                        type:  'div',
                        id:    'actionsRow',
                        class: 'w-[300px] flex flex-col items-center gap-4 pt-2'
                    }
                ]
            }
        });
    }

    renderField() {
        const wrap = $('<div>', { class: 'flex flex-col gap-1' });

        wrap.append($('<label>', {
            class: 'ws-field-lbl',
            for:   'passAcceso',
            text:  'Contraseña'
        }));

        wrap.append($('<input>', {
            id:       'passAcceso',
            type:     'password',
            class:    'ws-field',
            readonly: true
        }));

        $('#fieldRow').empty().append(wrap);
    }

    // El 0 arranca en la segunda columna para quedar centrado bajo el 1-2-3, y
    // Enter ocupa dos filas: es la forma exacta del teclado del boceto.
    keysJson() {
        return [
            {
                value: 7,
                label: '7'
            },
            {
                value: 8,
                label: '8'
            },
            {
                value: 9,
                label: '9'
            },
            {
                value:  'enter',
                label:  'Enter',
                action: true,
                class:  'ws-key-wide'
            },
            {
                value: 4,
                label: '4'
            },
            {
                value: 5,
                label: '5'
            },
            {
                value: 6,
                label: '6'
            },
            {
                value: 1,
                label: '1'
            },
            {
                value: 2,
                label: '2'
            },
            {
                value: 3,
                label: '3'
            },
            {
                value:  'clr',
                label:  'CLR',
                action: true
            },
            {
                value: 0,
                label: '0',
                class: 'col-start-2'
            }
        ];
    }

    renderActions() {
        const wrap = $('<div>', { class: 'w-full flex flex-col items-center gap-5' });

        const reloj = $('<button>', {
            type:  'button',
            id:    'btnReloj',
            class: 'ws-btn w-full h-[30px]',
            text:  'Reloj checador'
        });

        reloj.on('click', () => this.checkClock());

        const huella = $('<button>', {
            type:  'button',
            id:    'btnHuella',
            class: 'ws-btn-ghost w-[42px] h-[42px] flex items-center justify-center rounded self-end'
        });

        huella.append($('<i>', {
            'data-lucide': 'fingerprint',
            class:         'w-6 h-6'
        }));

        huella.on('click', () => this.readFingerprint());

        wrap.append(reloj);
        wrap.append(huella);

        $('#actionsRow').empty().append(wrap);

        lucide.createIcons();
    }

    // Franja inferior con la marca y el pie de version. El trazo del logo se dibuja
    // en SVG con currentColor para que el color siga viviendo en el CSS del tema.
    renderBrand() {
        const wrap = $('<div>', { class: 'flex flex-col items-center gap-4 w-full px-4' });

        const logo = $('<div>', { class: 'relative flex items-center justify-center h-[80px] w-[228px]' });

        // El lazo es un rectangulo redondeado inclinado, no una elipse: asi rodea
        // el texto sin cruzarlo, que es como cae en el boceto.
        const ring = $(
            '<svg viewBox="0 0 228 80" class="absolute inset-0 w-full h-full ws-logo-ring" fill="none">' +
            '<rect x="16" y="14" width="196" height="52" rx="24" transform="rotate(-6 114 40)" ' +
            'stroke="currentColor" stroke-width="5"/>' +
            '</svg>'
        );

        const arc = $(
            '<svg viewBox="0 0 228 80" class="absolute inset-0 w-full h-full ws-logo-arc" fill="none">' +
            '<path d="M22 42 Q6 62 28 74" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
            '</svg>'
        );

        const text = $('<div>', { class: 'relative flex items-baseline gap-1' });

        text.append($('<span>', {
            class: 'ws-logo-clip text-2xl',
            text:  'clip'
        }));

        text.append($('<span>', {
            class: 'text-white text-lg',
            text:  '+'
        }));

        text.append($('<span>', {
            class: 'text-white text-2xl font-bold',
            text:  WANSOFT_TERMINAL.marca
        }));

        logo.append(arc);
        logo.append(ring);
        logo.append(text);

        const foot = $('<div>', { class: 'w-full flex items-center justify-between' });

        foot.append($('<span>', {
            class: 'ws-foot',
            text:  `VERSIÓN: ${WANSOFT_TERMINAL.version}    SOPORTE: ${WANSOFT_TERMINAL.soporte}`
        }));

        foot.append($('<span>', {
            id:    'accessClock',
            class: 'ws-foot',
            text:  this.stamp()
        }));

        wrap.append(logo);
        wrap.append(foot);

        $('#brandRow').empty().append(wrap);
    }

    // -- Complements --

    onKeyPress(key) {
        if (key.value === 'clr') return this.clearPass();

        if (key.value === 'enter') return this.enter();

        this.pass += String(key.value);

        $('#passAcceso').val(this.pass);
    }

    clearPass() {
        this.pass = '';

        $('#passAcceso').val('');
    }

    enter() {
        if (!this.pass) {
            return this.alertBox({
                theme: WANSOFT_THEME,
                type:  'warning',
                title: 'Captura tu contraseña',
                timer: 1600
            });
        }

        app.go('inicio');
    }

    checkClock() {
        this.alertBox({
            theme: WANSOFT_THEME,
            type:  'info',
            title: `Reloj checador · ${this.stamp()}`,
            timer: 1800
        });
    }

    readFingerprint() {
        this.alertBox({
            theme: WANSOFT_THEME,
            type:  'info',
            title: 'Lector de huella no configurado en esta terminal',
            timer: 1800
        });
    }

    stamp() {
        const now = new Date();

        const fecha = now.toLocaleDateString('es-MX', {
            weekday: 'long',
            day:     'numeric',
            month:   'long',
            year:    'numeric'
        });

        const hora = now.toLocaleTimeString('es-MX', {
            hour:   '2-digit',
            minute: '2-digit'
        });

        return `${fecha} ${hora}`.toUpperCase();
    }
}

// -- Inicio --

class Inicio extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'inicio';
    }

    // -- Interface --

    renderInicio() {
        this.inicioLayout();

        tileMenu({
            parent:    'menuRow',
            id:        'tileInicio',
            cols:      3,
            tileClass:   'ws-btn ws-btn-card',
            footerClass: 'ws-btn ws-btn-tile',
            json:        this.tilesJson(),
            footer:      this.footerJson()
        });
    }

    inicioLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'inicioWrap',
                class: 'w-full max-w-3xl',
                container: [
                    {
                        type:  'div',
                        id:    'menuRow',
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    // Los cuatro modulos del Facturador abren su pagina; Cuentas y Administracion
    // son vistas de la propia terminal y solo cambian de pantalla.
    tilesJson() {
        return [
            {
                id:   'tcCuentas',
                icon: 'list',
                text: 'Cuentas',
                fn:   () => app.go('cuentas')
            },
            {
                id:   'tcCargas',
                icon: 'upload',
                text: 'Importación',
                fn:   () => this.open('/app/facture2/cargas.php')
            },
            {
                id:   'tcVentas',
                icon: 'receipt-text',
                text: 'Ventas',
                fn:   () => this.open('/app/facture2/ventas.php')
            },
            {
                id:   'tcTickets',
                icon: 'printer',
                text: 'Tickets',
                fn:   () => this.open('/app/facture2/tickets.php')
            },
            {
                id:   'tcCatalogos',
                icon: 'book-open',
                text: 'Catálogos',
                fn:   () => this.open('/app/facture2/catalogos.php')
            },
            {
                id:   'tcAdmin',
                icon: 'settings',
                text: 'Administración',
                fn:   () => app.go('admin')
            }
        ];
    }

    footerJson() {
        return [
            {
                id:   'tcBloquear',
                text: 'Bloquear',
                fn:   () => app.go('acceso')
            },
            {
                id:   'tcSalir',
                text: 'Salir del sistema',
                fn:   () => admin.exitSystem()
            }
        ];
    }

    // -- Complements --

    open(url) {
        window.location.href = url;
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
        const filters = app.filters;

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
        this.pending('Abrir cuenta nueva');
    }

    editCuenta() {
        if (!this.selected) return this.needSelection();

        this.pending(`Editar la cuenta ${this.selected}`);
    }

    printCuenta() {
        if (!this.selected) return this.needSelection();

        this.pending(`Imprimir la cuenta ${this.selected}`);
    }

    chargeCuenta() {
        if (!this.selected) return this.needSelection();

        this.pending(`Cobrar la cuenta ${this.selected}`);
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

    pending(accion) {
        this.alertBox({
            theme: WANSOFT_THEME,
            type:  'info',
            title: `${accion}: pendiente de backend`,
            timer: 1800
        });
    }
}

// -- Admin --

class Admin extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'admin';
    }

    // -- Interface --

    renderMenu() {
        this.menuLayout();

        tileMenu({
            parent: 'menuRow',
            id:     'tileAdmin',
            cols:   4,
            json:   this.tilesJson(),
            footer: this.footerJson()
        });
    }

    menuLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'adminWrap',
                class: 'w-full max-w-3xl',
                container: [
                    {
                        type:  'div',
                        id:    'menuRow',
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    // Los nulos son los huecos de la rejilla del boceto: sin ellos, "Reportes
    // locales" subiria de fila y el menu dejaria de leerse por bloques. El primero
    // se ocupo con Catalogos, que no tiene rotulo equivalente en el boceto.
    //
    // Los tiles con url abren el modulo real del Facturador —el mismo js, servido
    // con el tema de la terminal—; el resto sigue sin backend.
    tilesJson() {
        return [
            {
                id:   'tlNetsilver',
                text: 'Configurar netsilver',
                fn:   () => this.pending('Configurar netsilver')
            },
            {
                id:   'tlCorte',
                text: 'Realizar corte',
                fn:   () => this.pending('Realizar corte')
            },
            {
                id:   'tlFactura',
                text: 'Emitir factura',
                fn:   () => this.open('/app/facture2/ventas.php')
            },
            {
                id:   'tlHuella',
                text: 'Huella digital',
                fn:   () => this.pending('Huella digital')
            },
            {
                id:   'tlTicket',
                text: 'Reimprimir ticket',
                fn:   () => this.open('/app/facture2/tickets.php')
            },
            {
                id:   'tlFormaPago',
                text: 'Cambiar forma de pago',
                fn:   () => this.pending('Cambiar forma de pago')
            },
            {
                id:   'tlVale',
                text: 'Registrar vale',
                fn:   () => this.pending('Registrar vale')
            },
            {
                id:   'tlPersonas',
                text: 'Cambiar No. Personas',
                fn:   () => this.pending('Cambiar No. Personas')
            },
            {
                id:   'tlCancelaciones',
                text: 'Cancelaciones',
                fn:   () => this.pending('Cancelaciones')
            },
            {
                id:   'tlReimpFactura',
                text: 'Reimprimir factura',
                fn:   () => this.open('/app/facture2/tickets.php')
            },
            {
                id:   'tlPropinas',
                text: 'Propinas',
                fn:   () => this.pending('Propinas')
            },
            {
                id:   'tlCatalogos',
                text: 'Catálogos',
                fn:   () => this.open('/app/facture2/catalogos.php')
            },
            {
                id:   'tlReportes',
                text: 'Reportes locales',
                fn:   () => this.open('/app/facture2/cargas.php')
            },
            {
                id:   'tlDepurar',
                text: 'Depurar BD',
                fn:   () => this.pending('Depurar BD')
            },
            {
                id:   'tlCajon',
                text: 'Abrir Cajón',
                fn:   () => this.pending('Abrir Cajón')
            },
            {
                id:   'tlDepositos',
                text: 'Depósitos',
                fn:   () => this.pending('Depósitos')
            },
            {
                id:   'tlRetiros',
                text: 'Retiros',
                fn:   () => this.pending('Retiros')
            },
            {
                id:   'tlVoucher',
                text: 'Reimpresión de voucher',
                fn:   () => this.pending('Reimpresión de voucher')
            },
            {
                id:   'tlAnticipados',
                text: 'Pagos anticipados',
                fn:   () => this.pending('Pagos anticipados')
            },
            null
        ];
    }

    footerJson() {
        return [
            {
                id:   'tlSalir',
                text: 'Salir del sistema',
                fn:   () => this.exitSystem()
            },
            {
                id:   'tlRegresar',
                text: 'Regresar',
                fn:   () => app.back()
            }
        ];
    }

    // -- Complements --

    exitSystem() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Salir del sistema',
                text:              'Se cerrara la sesion de la terminal y volveras a la pantalla de acceso.',
                icon:              'warning',
                confirmButtonText: 'Si, salir',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed) app.go('acceso');
        });
    }

    open(url) {
        window.location.href = url;
    }

    pending(accion) {
        this.alertBox({
            theme: WANSOFT_THEME,
            type:  'info',
            title: `${accion}: pendiente de backend`,
            timer: 1800
        });
    }
}
