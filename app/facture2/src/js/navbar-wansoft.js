// -- Navbar Wansoft --

// Banda superior de la terminal: la fila de datos de operacion del boceto
// (marca, usuario, turno, fecha de operacion, mesas y reloj). No es el navbar de
// Huubie ni el del Facturador: aqui no hay menu de usuario ni toggle de tema,
// porque la terminal Wansoft no los tiene. Lo que si tiene es el reloj vivo, que
// en un POS es dato de turno, no adorno.
//
// Sin fetch: los rotulos salen de WANSOFT_TERMINAL mientras el modulo no tenga
// backend propio.

class Navbar {

    // -- Initial --

    constructor() {
        this.timer = null;
    }

    // -- Interface --

    init(options) {
        this.render(options);
        this.startClock();
    }

    render(options) {
        // Las paginas de modulo se rotulan solas: el shell declara cual es en el
        // propio contenedor (<div id="menu-navbar" data-modulo="Importacion">), y
        // con eso la banda cambia de terminal a modulo sin un global mas.
        const defaults = {
            parent:  '#menu-navbar',
            marca:   WANSOFT_TERMINAL.marca,
            usuario: WANSOFT_TERMINAL.usuario,
            turno:   WANSOFT_TERMINAL.turno,
            fechaOp: this.today(),
            mesas:   '',
            modulo:  $('#menu-navbar').data('modulo') || '',
            back:    $('#menu-navbar').data('back') || '',
            palette: WANSOFT_PALETTE.navbar
        };

        this.settings = Object.assign({}, defaults, options || {});
        this.parent   = $(this.settings.parent);

        const p = this.settings.palette;

        const band = $('<div>', {
            class: 'w-full flex items-center justify-between px-3 h-11 shrink-0',
            css: {
                backgroundColor: p.bg,
                borderBottom:    `1px solid ${p.border}`
            }
        });

        band.append(this.left());
        band.append(this.right());

        this.parent.empty().append(band);
    }

    left() {
        const box = $('<div>', { class: 'flex items-center gap-6' });

        if (this.settings.back) box.append(this.backBtn());

        box.append($('<span>', {
            class: 'ws-brand',
            text:  this.settings.marca
        }));

        this.fields().forEach((field) => {
            box.append($('<span>', {
                id:    field.id,
                class: 'ws-meta',
                text:  field.text
            }));
        });

        return box;
    }

    backBtn() {
        const btn = $('<button>', {
            type:  'button',
            id:    'navBack',
            class: 'ws-back',
            title: 'Regresar al menú'
        });

        btn.append($('<i>', {
            'data-lucide': 'arrow-left',
            class:         'w-4 h-4'
        }));

        btn.on('click', () => { window.location.href = this.settings.back; });

        return btn;
    }

    // En una pagina de modulo el rotulo de usuario cede su lugar al nombre del
    // modulo, igual que hace el menu de administracion.
    fields() {
        return [
            {
                id:   'navUsuario',
                text: this.settings.modulo || `Usuario: ${this.settings.usuario}`
            },
            {
                id:   'navTurno',
                text: `Turno: ${this.settings.turno}`
            },
            {
                id:   'navFechaOp',
                text: `Fecha Op: ${this.settings.fechaOp}`
            },
            {
                id:   'navMesas',
                text: `MESA(S): ${this.settings.mesas}`
            }
        ];
    }

    right() {
        const box = $('<div>', { class: 'flex items-center gap-2' });

        box.append($('<span>', {
            id:    'navClock',
            class: 'ws-meta-muted',
            text:  this.clock()
        }));

        box.append($('<i>', {
            'data-lucide': 'chevrons-left-right',
            class:         'w-4 h-4 text-white'
        }));

        return box;
    }

    // -- Complements --

    startClock() {
        clearInterval(this.timer);

        this.timer = setInterval(() => $('#navClock').text(this.clock()), 1000 * 30);

        lucide.createIcons();
    }

    clock() {
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

        return `${fecha} ${hora}`;
    }

    today() {
        const now = new Date();
        const dd  = String(now.getDate()).padStart(2, '0');
        const mm  = String(now.getMonth() + 1).padStart(2, '0');

        return `${dd}-${mm}-${now.getFullYear()}`;
    }
}

$(() => {
    if (!$('#menu-navbar').length) return;

    new Navbar().init();
});
