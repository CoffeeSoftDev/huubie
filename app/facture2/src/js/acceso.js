let apiPos = '/app/facture2/ctrl/ctrl-facture2-pos.php';
let app, acceso;

$(() => {
    acceso = new Acceso(apiPos, 'root');
    app    = new App(apiPos, 'root');

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

        acceso.renderAcceso();
    }

    // La pantalla de bloqueo no lleva banda de datos ni barra de filtros: en el
    // boceto la terminal solo se identifica despues de entrar. La franja de marca
    // es propia de esta pantalla y no aparece en ninguna otra.
    //
    // contentRow va relativo porque el lector de huella se ancla a su esquina
    // inferior derecha, no al flujo de la tarjeta.
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
                        class: 'flex-1 min-h-0 relative flex items-center justify-center px-4 py-10'
                    },
                    {
                        type:  'div',
                        id:    'brandRow',
                        class: 'ws-band flex-shrink-0 flex flex-col'
                    }
                ]
            }
        });
    }
}

// -- Acceso --

class Acceso extends Templates {

    // -- Initial --

    // El campo se corta a 12 digitos: con el interletrado del boceto, mas texto se
    // sale de la tarjeta de 280px.
    static get MAX_PASS() { return 12; }

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'acceso';
        this.pass         = '';
        this.clockTimer   = null;
    }

    // -- Interface --

    renderAcceso() {
        this.pass = '';

        this.accessLayout();

        this.renderField();

        keypad({
            parent: 'keypadRow',
            id:     'keypadAcceso',
            class:  'ws-keypad grid grid-cols-4 gap-1.5 w-full',
            json:   this.keysJson(),
            onKey:  (key) => this.onKeyPress(key)
        });

        this.renderActions();
        this.renderPrint();
        this.renderBrand();
    }

    accessLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'accessWrap',
                class: 'w-full h-full flex items-center justify-center',
                container: [
                    {
                        type:  'div',
                        id:    'accessCard',
                        class: 'w-full max-w-[280px] select-none',
                        children: [
                            {
                                id: 'fieldRow'
                            },
                            {
                                id:    'keypadRow',
                                class: 'mt-3'
                            },
                            {
                                id:    'actionsRow',
                                class: 'mt-9'
                            }
                        ]
                    },
                    {
                        type:  'div',
                        id:    'printRow',
                        class: 'absolute bottom-6 right-6'
                    }
                ]
            }
        });
    }

    renderField() {
        const wrap = $('<div>');

        wrap.append($('<label>', {
            class: 'ws-field-lbl block text-center mb-1.5',
            for:   'passAcceso',
            text:  'Contraseña'
        }));

        wrap.append($('<input>', {
            id:       'passAcceso',
            type:     'password',
            class:    'ws-field w-full h-9 px-3',
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
        const reloj = $('<button>', {
            type:  'button',
            id:    'btnReloj',
            class: 'ws-btn ws-btn-access w-full h-11',
            text:  'Reloj checador'
        });

        reloj.on('click', () => this.checkClock());

        $('#actionsRow').empty().append(reloj);
    }

    // El recuadro del lector va vertical, en la proporcion del que trae la
    // terminal fisica; el dibujo de la huella es una imagen, no un icono de
    // libreria, para que sea el mismo trazo del boceto.
    renderPrint() {
        const huella = $('<button>', {
            type:         'button',
            id:           'btnHuella',
            class:        'ws-print w-14 h-[72px] flex items-center justify-center',
            'aria-label': 'Acceso con huella digital'
        });

        huella.append($('<img>', {
            src:   '/app/facture2/src/img/huella.png',
            alt:   '',
            class: 'w-11'
        }));

        huella.on('click', () => this.readFingerprint());

        $('#printRow').empty().append(huella);
    }

    // Franja inferior: marca, linea de corte y pie de version. La linea no llega a
    // las orillas —se recorta 0.3 cm por lado— como en el boceto.
    renderBrand() {
        this.createLayout({
            parent: 'brandRow',
            design: false,
            data: {
                id:    'brandWrap',
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        id:    'brandLogo',
                        class: 'flex items-center justify-center py-2'
                    },
                    {
                        type:  'div',
                        id:    'brandLine',
                        class: 'ws-band-div mx-[0.3cm]'
                    },
                    {
                        type:  'div',
                        id:    'brandFoot',
                        class: 'flex items-center justify-between px-4 py-2.5'
                    }
                ]
            }
        });

        this.renderLogo();
        this.renderFoot();
    }

    renderLogo() {
        $('#brandLogo').empty().append($('<img>', {
            src:   '/app/facture2/src/img/wansoft-logo.png',
            alt:   `clip + ${WANSOFT_TERMINAL.marca}`,
            class: 'w-52 h-auto drop-shadow-lg'
        }));
    }

    renderFoot() {
        const datos = $('<div>', { class: 'flex items-center gap-5' });

        datos.append($('<span>', {
            class: 'ws-foot',
            text:  `VERSIÓN: ${WANSOFT_TERMINAL.version}`
        }));

        datos.append($('<span>', {
            class: 'ws-foot',
            text:  `SOPORTE: ${WANSOFT_TERMINAL.soporte}`
        }));

        const reloj = $('<span>', {
            id:    'accessClock',
            class: 'ws-foot',
            text:  this.stamp()
        });

        $('#brandFoot').empty().append(datos).append(reloj);

        this.startClock();
    }

    // -- Complements --

    onKeyPress(key) {
        if (key.value === 'clr') return this.clearPass();

        if (key.value === 'enter') return this.enter();

        if (this.pass.length >= Acceso.MAX_PASS) return;

        this.pass += String(key.value);

        $('#passAcceso').val(this.pass);
    }

    clearPass() {
        this.pass = '';

        $('#passAcceso').val('');
    }

    enter() {
        if (!this.pass) return this.shakeField();

        posGo('inicio');
    }

    shakeField() {
        const field = $('#passAcceso');

        field.removeClass('ws-shake');

        // Entre quitar y poner la clase hace falta forzar un reflow: sin el, un
        // segundo toque seguido no vuelve a arrancar la animacion.
        void field[0].offsetWidth;

        field.addClass('ws-shake');

        this.alertBox({
            theme: WANSOFT_THEME,
            type:  'warning',
            title: 'Captura tu contraseña',
            timer: 1600
        });
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

    startClock() {
        clearInterval(this.clockTimer);

        this.clockTimer = setInterval(() => $('#accessClock').text(this.stamp()), 1000);
    }

    stamp() {
        const now = new Date();

        const fecha = now.toLocaleDateString('es-MX', {
            weekday: 'long',
            day:     '2-digit',
            month:   'long',
            year:    'numeric'
        });

        const hora = now.toLocaleTimeString('es-MX', {
            hour:   '2-digit',
            minute: '2-digit',
            hour12: false
        });

        return `${fecha} ${hora}`.toUpperCase();
    }
}
