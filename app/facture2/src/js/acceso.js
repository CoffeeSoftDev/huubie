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
                        class: 'flex-1 min-h-0 flex flex-col items-center justify-center gap-5'
                    },
                    {
                        type:  'div',
                        id:    'brandRow',
                        class: 'ws-band flex-shrink-0 flex flex-col items-center justify-center gap-6 py-6'
                    }
                ]
            }
        });
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

        posGo('inicio');
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
