// -- ModuleCard --

// La rejilla de modulos de la terminal. Mismo papel que el ModuleCard de app/ —dar
// entrada a cada modulo desde una tarjeta— pero en version tactil: bloques planos,
// sin buscador ni descripcion, porque aqui se opera con el dedo y de memoria.
//
// Las celdas son de alto fijo para que un rotulo de dos lineas no deforme su fila, y
// los huecos del json (null) se respetan: en el boceto la rejilla tiene espacios en
// blanco que hacen caer cada bloque en su columna.
//
// El pie es opcional y lleva las dos salidas del menu, una a cada extremo, con el
// ancho de una columna para que calcen con la rejilla de arriba.
//
// Una tarjeta con locked es la que todavia no tiene modulo: se pinta cerrada, con su
// candado, y no responde al tacto. Es la excepcion a TRM-015 —ningun boton sin
// handler—, porque ahi el silencio no se lee como falla sino como candado.

function moduleCard(options) {
    const defaults = {
        parent:    'root',
        id:        'moduleCard',
        cols:      4,
        gap:       '10px',
        class:     'grid',
        cardClass:   'ws-btn ws-btn-tile',
        footerClass: '',
        iconClass:   'w-7 h-7',
        json:      [],
        footer:    []
    };

    const opts = Object.assign({}, defaults, options || {});

    const wrap = $('<div>', { id: `${opts.id}Wrap` });

    const grid = $('<div>', {
        id:    opts.id,
        class: opts.class,
        css: {
            gridTemplateColumns: `repeat(${opts.cols}, minmax(0, 1fr))`,
            gap:                 opts.gap
        }
    });

    opts.json.forEach((card, idx) => {
        if (!card) return grid.append($('<div>'));

        const cell = $('<button>', {
            type:  'button',
            id:    card.id || `${opts.id}_${idx}`,
            class: `${opts.cardClass}${card.locked ? ' is-locked' : ''}`
        });

        if (card.locked) {
            cell.prop('disabled', true);

            cell.append($('<i>', {
                'data-lucide': 'lock',
                class:         'ws-card-lock w-3.5 h-3.5'
            }));
        }

        // Con icono la celda se lee en dos pisos —simbolo arriba, nombre abajo—;
        // sin el, solo el rotulo, que es como cae el menu de administracion.
        if (card.icon) {
            cell.append($('<i>', {
                'data-lucide': card.icon,
                class:         opts.iconClass
            }));
        }

        cell.append($('<span>', { text: card.text }));

        if (card.fn) cell.on('click', card.fn);

        grid.append(cell);
    });

    wrap.append(grid);

    if (opts.footer.length) {
        const foot = $('<div>', {
            class: 'flex items-center justify-between',
            css:   { marginTop: '64px' }
        });

        opts.footer.forEach((card) => {
            const cell = $('<button>', {
                type:  'button',
                id:    card.id,
                class: opts.footerClass || opts.cardClass,
                text:  card.text,
                css:   { width: `calc((100% - ${opts.gap} * ${opts.cols - 1}) / ${opts.cols})` }
            });

            if (card.fn) cell.on('click', card.fn);

            foot.append(cell);
        });

        wrap.append(foot);
    }

    $(`#${opts.parent}`).empty().append(wrap);

    lucide.createIcons();

    return wrap;
}
