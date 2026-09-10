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
            // {
            //     id:   'navFechaOp',
            //     text: `Fecha Op: ${this.settings.fechaOp}`
            // },
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

        box.append(this.signalIcon());

        return box;
    }

    // El icono va en SVG inline y no como <img>: asi el trazo hereda el blanco de
    // la banda con currentColor, en vez de quedar clavado en un color del archivo.
    // Cada onda blanca lleva debajo su sombra negra, un arco mas corto corrido
    // hacia el centro: la sombra siempre cae adentro, nunca hacia el borde.
    signalIcon() {
        const ns  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');

        const sombras = [
            'M9.4 8.96 A4 4 0 0 0 9.4 15.04',
            'M14.6 8.96 A4 4 0 0 1 14.6 15.04',
            'M7.39 6.6 A7.1 7.1 0 0 0 7.39 17.4',
            'M16.61 6.6 A7.1 7.1 0 0 1 16.61 17.4',
            'M5.38 4.24 A10.2 10.2 0 0 0 5.38 19.76',
            'M18.62 4.24 A10.2 10.2 0 0 1 18.62 19.76'
        ];

        const ondas = [
            'M9.13 7.9 A5 5 0 0 0 9.13 16.1',
            'M14.87 7.9 A5 5 0 0 1 14.87 16.1',
            'M7.35 5.36 A8.1 8.1 0 0 0 7.35 18.64',
            'M16.65 5.36 A8.1 8.1 0 0 1 16.65 18.64',
            'M5.58 2.83 A11.2 11.2 0 0 0 5.58 21.17',
            'M18.42 2.83 A11.2 11.2 0 0 1 18.42 21.17'
        ];

        $(svg).attr({
            viewBox:          '-1 -1 26 26',
            fill:             'none',
            stroke:           'currentColor',
            'stroke-width':   2.2,
            'stroke-linecap': 'round',
            class:            'w-6 h-6 text-white'
        });

        const trazo = (d, attrs) => {
            const path = document.createElementNS(ns, 'path');

            $(path).attr(Object.assign({ d: d }, attrs || {}));

            svg.appendChild(path);
        };

        sombras.forEach((d) => trazo(d, { stroke: '#000000', 'stroke-width': 2 }));

        const centro = document.createElementNS(ns, 'circle');

        $(centro).attr({ cx: 12, cy: 12, r: 3, fill: 'currentColor', stroke: 'none' });

        svg.appendChild(centro);

        ondas.forEach((d) => trazo(d));

        return svg;
    }

    // -- Complements --

    startClock() {
        clearInterval(this.timer);

        this.timer = setInterval(() => $('#navClock').text(this.clock()), 1000 * 30);

        lucide.createIcons();
    }

    clock() {
        const now = new Date();

        const partes = new Intl.DateTimeFormat('es-MX', {
            weekday: 'long',
            day:     'numeric',
            month:   'long',
            year:    'numeric'
        }).formatToParts(now).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});

        const hora = now.toLocaleTimeString('es-MX', {
            hour:      '2-digit',
            minute:    '2-digit',
            hourCycle: 'h23'
        });

        return `${partes.weekday}, ${partes.day} ${partes.month} ${partes.year} ${hora}`;
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
