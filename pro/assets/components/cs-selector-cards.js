// -- csSelectorCards --
// Pantalla de elección en tarjetas, la del selector de sucursales (sucursales/):
// título, saludo, rejilla de tarjetas (ícono, nombre, ubicación y estado) y pie
// con "Cerrar sesión". Los colores salen de los tokens de página de themes.css,
// así que sigue al tema claro u oscuro sin más. Es de pantalla completa: el
// encabezado y la primera fila se centran en la ventana (ver anchor()).

Templates.prototype.csSelectorCards = function (options) {
    const defaults = {
        parent:   'root',
        id:       'csSelectorCards',
        title:    '',
        subtitle: '',
        user:     '',
        json:     [],
        empty: {
            icon:  'store',
            title: 'Sin opciones disponibles',
            text:  ''
        },
        onSelect: () => {},
        onLogout: null
    };

    const opts  = Object.assign({}, defaults, options);
    opts.empty  = Object.assign({}, defaults.empty, (options || {}).empty || {});

    const tones = {
        open:    { dot: 'bg-green-400', text: 'text-green-500' },
        warning: { dot: 'bg-amber-400', text: 'text-amber-500' },
        neutral: { dot: 'bg-gray-400',  text: 'sel-muted' }
    };

    if (!document.getElementById('csSelectorCardsStyles')) {
        $('head').append(`
            <style id="csSelectorCardsStyles">
                :root {
                    --sel-card:      var(--surface, #FFFFFF);
                    --sel-border:    var(--line, #E5E7EB);
                    --sel-text:      var(--ink, #111827);
                    --sel-muted:     var(--ink-dim, #6B7280);
                    --sel-pill-bg:   #FFFFFF;
                }
                body.dark-mode {
                    --sel-card:      var(--dk-card, #1F2A37);
                    --sel-border:    var(--dk-line, #374151);
                    --sel-text:      var(--dk-text, #F9FAFB);
                    --sel-muted:     var(--dk-muted, #9CA3AF);
                    --sel-pill-bg:   var(--dk-hover, #1D2937);
                }
                .sel-card   { background: var(--sel-card); border-color: var(--sel-border); }
                .sel-text   { color: var(--sel-text); }
                .sel-muted  { color: var(--sel-muted); }
                .sel-pill   { background: var(--sel-pill-bg); border-color: var(--sel-border); color: var(--sel-muted); }
            </style>`);
    }

    // -- Tarjeta --

    const card = (item) => {
        const tone = tones[(item.status || {}).tone] || tones.neutral;

        const head = $('<div>', { class: 'flex items-start justify-between mb-3' }).append(
            $('<div>', { class: `${item.iconClass || 'bg-blue-600'} rounded-lg p-2.5 flex-shrink-0` })
                .append($('<i>', { 'data-lucide': item.icon || 'store', class: 'w-5 h-5 text-white' })),
            item.badge
                ? $('<span>', {
                    class: 'text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/[.12] border border-blue-600/30 text-blue-600 self-start leading-none',
                    text:  item.badge
                })
                : $('<i>', { 'data-lucide': 'arrow-right', class: 'w-4 h-4 sel-muted mt-1 flex-shrink-0' })
        );

        const location = item.location
            ? $('<div>', { class: 'flex items-center gap-1 sel-muted text-xs mb-2 min-w-0' }).append(
                $('<i>', { 'data-lucide': item.locationIcon || 'map-pin', class: 'w-3 h-3 flex-shrink-0' }),
                $('<span>', { class: 'truncate', text: item.location })
            )
            : $('<div>', { class: 'mb-2' });

        const status = $('<div>', { class: 'flex items-center gap-3 text-xs sel-muted' });

        if (item.status && item.status.text) {
            status.append($('<div>', { class: 'flex items-center gap-1 whitespace-nowrap' }).append(
                $('<span>', { class: `w-2 h-2 rounded-full ${tone.dot} inline-block shrink-0` }),
                $('<span>', { class: tone.text, text: item.status.text })
            ));
        }

        // flex-col: un <button> centra su contenido en vertical, y la tarjeta sin
        // ubicación (más baja) quedaba desfasada de las de su fila.
        return $('<button>', {
            type:        'button',
            'data-card': item.id,
            class:       'sel-card w-full flex flex-col cursor-pointer rounded-xl p-4 text-left transition-all duration-200 select-none hover:!border-blue-600 focus:outline-none focus-visible:!border-blue-600 '
                       + (item.selected ? 'border-2' : 'border')
        }).append(
            head,
            $('<h3>', { class: 'text-base font-bold sel-text mb-1 truncate', text: item.title }),
            location,
            status
        );
    };

    // -- Pantalla --

    // El margen de arriba lo pone anchor(): sin justify-center, que centraba todo
    // el bloque y con cada fila nueva subía el título.
    const container = $('<div>', {
        id:    opts.id,
        class: 'w-full min-h-full flex flex-col items-center text-center px-4 pb-10'
    });

    const header = $('<div>', { class: 'flex flex-col items-center' }).append(
        $('<h1>', { class: 'text-2xl font-bold mb-1 sel-text', text: opts.title }),
        $('<p>', { class: 'sel-muted mb-4 text-sm', text: opts.subtitle })
    );

    if (opts.user) {
        header.append($('<div>', { class: 'sel-pill flex items-center gap-2 border rounded-full px-3 py-1.5 mb-6' }).append(
            $('<i>', { 'data-lucide': 'user-circle', class: 'w-4 h-4 sel-muted' }),
            $('<span>', { class: 'text-xs sel-muted' }).append(
                document.createTextNode('Bienvenid@ de nuevo, '),
                $('<span>', { class: 'font-semibold sel-text', text: opts.user }),
                document.createTextNode(' ✨')
            )
        ));
    }

    container.append(header);

    // Lo que va debajo del encabezado: la rejilla o, sin opciones, el aviso.
    const body = opts.json.length
        ? $('<div>', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl' }).append(opts.json.map(card))
        : $('<div>', { class: 'sel-card w-full max-w-md flex flex-col items-center justify-center text-center border rounded-xl p-8' }).append(
            $('<i>', { 'data-lucide': opts.empty.icon, class: 'w-10 h-10 sel-muted mb-3' }),
            $('<h3>', { class: 'text-base font-semibold sel-text mb-1', text: opts.empty.title }),
            $('<p>', { class: 'sel-muted text-sm', text: opts.empty.text })
        );

    container.append(body);

    if (typeof opts.onLogout === 'function') {
        container.append($('<div>', { class: 'mt-16 flex items-center gap-2 sel-muted text-sm' }).append(
            $('<i>', { 'data-lucide': 'shield-check', class: 'w-4 h-4' }),
            $('<span>', { text: 'Sesión segura ·' }),
            $('<a>', { href: '#', 'data-logout': '1', class: 'sel-text hover:opacity-70 transition-opacity', text: 'Cerrar sesión' })
        ));
    }

    // -- Eventos --

    container.on('click', '[data-card]', (e) => {
        const id   = $(e.currentTarget).attr('data-card');
        const item = opts.json.find((c) => String(c.id) === String(id));
        if (item) opts.onSelect(item);
    });

    container.on('click', '[data-logout]', (e) => {
        e.preventDefault();
        opts.onLogout();
    });

    // -- Posición --
    // El encabezado y la PRIMERA fila de tarjetas quedan al centro de la
    // pantalla; las demás filas siguen hacia abajo (la página se desplaza). Ni el
    // encabezado ni una fila cambian de alto con más tarjetas, así que el título
    // se queda en su lugar aunque se agreguen empresas.
    const anchor = () => {
        const first = opts.json.length ? body.children().first() : body;
        const free  = window.innerHeight - header.outerHeight(true) - (first.outerHeight() || 0);
        container.css('padding-top', `${Math.max(32, Math.round(free / 2))}px`);
    };

    $(`#${opts.parent}`).html(container);
    if (window.lucide) lucide.createIcons();

    anchor();
    $(window).off('resize.csSelectorCards').on('resize.csSelectorCards', anchor);
    // La fuente (Inter) puede llegar después y cambiar los altos.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(anchor);
};
