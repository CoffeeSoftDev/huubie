// -- Keypad --

// Teclado numerico tactil de la pantalla de acceso. No existe en coffeeSoft.js
// —se reviso antes de crearlo— y ningun componente del core cubre una rejilla de
// teclas con una accion que ocupa dos filas.
//
// Las teclas salen de json: el componente no sabe que hay un 7 ni un Enter, solo
// coloca lo que recibe. Los colores viven en wansoft-theme.css (.ws-key).

function keypad(options) {
    const defaults = {
        parent:  'root',
        id:      'keypad',
        class:   'ws-keypad grid grid-cols-4 gap-2 w-[300px]',
        keyClass: 'ws-key',
        json:    [],
        onKey:   () => { }
    };

    const opts = Object.assign({}, defaults, options || {});

    const grid = $('<div>', {
        id:    opts.id,
        class: opts.class
    });

    opts.json.forEach((key) => {
        const cell = $('<button>', {
            type:  'button',
            id:    `${opts.id}_${key.value}`,
            class: [opts.keyClass, key.class || '', key.action ? 'ws-key-act' : ''].join(' ').trim(),
            text:  key.label
        });

        cell.on('click', () => opts.onKey(key));

        grid.append(cell);
    });

    $(`#${opts.parent}`).empty().append(grid);

    return grid;
}
