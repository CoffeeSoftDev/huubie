// -- PosToolbar --

// Barra de acciones de la terminal: icono grande con su rotulo debajo, repartido
// en tres grupos (izquierda, centro, derecha) sobre la banda azul.
//
// El grupo del centro admite ademas puntos de estado (dots), que es como el POS
// filtra las cuentas por color. Cada boton se declara en json con su fn; ninguno
// se pinta sin handler (TRM-015).

function posToolbar(options) {
    const defaults = {
        parent:      'root',
        id:          'posToolbar',
        class:       'relative flex items-center justify-between px-3 py-1.5',
        groupClass:  'flex items-center',
        centerClass: 'absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1',
        json:        [],
        dots:        [],
        dotsLabel:   'Filtros',
        onDot:       () => { }
    };

    const opts = Object.assign({}, defaults, options || {});

    const bar = $('<div>', {
        id:    opts.id,
        class: opts.class
    });

    const groups = {
        left:  $('<div>', { class: opts.groupClass }),
        right: $('<div>', { class: opts.groupClass })
    };

    opts.json.forEach((item) => {
        const tool = $('<button>', {
            type:  'button',
            id:    item.id,
            class: 'ws-tool'
        });

        const box = $('<span>', {
            class: item.circle === false ? 'ws-tool-flat' : 'ws-tool-ico'
        });

        box.append($('<i>', {
            'data-lucide': item.icon,
            class:         item.iconClass || 'w-5 h-5'
        }));

        tool.append(box);

        if (item.label) {
            tool.append($('<span>', {
                class: 'ws-tool-lbl',
                text:  item.label
            }));
        }

        if (item.fn) tool.on('click', item.fn);

        groups[item.group === 'right' ? 'right' : 'left'].append(tool);
    });

    bar.append(groups.left);

    if (opts.dots.length) {
        const center = $('<div>', {
            id:    `${opts.id}Dots`,
            class: opts.centerClass
        });

        const row = $('<div>', { class: 'flex items-center gap-2' });

        opts.dots.forEach((dot) => {
            const point = $('<button>', {
                type:       'button',
                id:         `${opts.id}_${dot.id}`,
                class:      `ws-dot ${dot.class}${dot.active ? ' is-on' : ''}`,
                title:      dot.label,
                'data-dot': dot.id
            });

            point.on('click', () => opts.onDot(dot));

            row.append(point);
        });

        center.append(row);
        center.append($('<span>', {
            class: 'ws-tool-lbl',
            text:  opts.dotsLabel
        }));

        bar.append(center);
    }

    bar.append(groups.right);

    $(`#${opts.parent}`).empty().append(bar);

    lucide.createIcons();

    return bar;
}
