// -- TileMenu --

// Rejilla de botones grandes del menu de administracion. Las celdas son de alto
// fijo para que un rotulo de dos lineas no deforme su fila, y los huecos del json
// (null) se respetan: en el boceto la rejilla tiene espacios en blanco que hacen
// caer cada bloque en su columna.
//
// El pie es opcional y lleva las dos salidas del menu, una a cada extremo, con el
// ancho de una columna para que calcen con la rejilla de arriba.

function tileMenu(options) {
    const defaults = {
        parent:    'root',
        id:        'tileMenu',
        cols:      4,
        gap:       '10px',
        class:     'grid',
        tileClass:   'ws-btn ws-btn-tile',
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

    opts.json.forEach((tile, idx) => {
        if (!tile) return grid.append($('<div>'));

        const cell = $('<button>', {
            type:  'button',
            id:    tile.id || `${opts.id}_${idx}`,
            class: opts.tileClass
        });

        // Con icono la celda se lee en dos pisos —simbolo arriba, nombre abajo—;
        // sin el, solo el rotulo, que es como cae el menu de administracion.
        if (tile.icon) {
            cell.append($('<i>', {
                'data-lucide': tile.icon,
                class:         opts.iconClass
            }));
        }

        cell.append($('<span>', { text: tile.text }));

        if (tile.fn) cell.on('click', tile.fn);

        grid.append(cell);
    });

    wrap.append(grid);

    if (opts.footer.length) {
        const foot = $('<div>', {
            class: 'flex items-center justify-between',
            css:   { marginTop: '64px' }
        });

        opts.footer.forEach((tile) => {
            const cell = $('<button>', {
                type:  'button',
                id:    tile.id,
                class: opts.footerClass || opts.tileClass,
                text:  tile.text,
                css:   { width: `calc((100% - ${opts.gap} * ${opts.cols - 1}) / ${opts.cols})` }
            });

            if (tile.fn) cell.on('click', tile.fn);

            foot.append(cell);
        });

        wrap.append(foot);
    }

    $(`#${opts.parent}`).empty().append(wrap);

    lucide.createIcons();

    return wrap;
}
