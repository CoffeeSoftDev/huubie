// ModuleCard — grid de tarjetas con header + buscador.
// Portado desde app/src/js/components/moduleCard.js para el dashboard de Inventario.
// Defaults en paleta LIGHT con acento terracota (Arcilla Invernal); los colores son
// configurables vía options.colors. Cada card admite onClick (navegar o abrir submódulos).
class ModuleCard {
    constructor(parent, options) {
        this.uid      = 'mc_' + Math.random().toString(36).slice(2, 7);
        this.parent   = parent;
        this.options  = options || {};
        this.settings = null;
        this.searchCb = null;
    }

    buildSettings() {
        const defaults = {
            header: {
                show:     true,
                title:    'Hola',
                subtitle: '',
                search: {
                    show:        true,
                    placeholder: 'Buscar módulo...',
                    shortcut:    'Ctrl+K',
                    width:       'w-full md:w-[380px]',
                },
            },
            grid: {
                cols:   'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
                gap:    'gap-x-3 gap-y-6',
                height: 'h-[180px]',
            },
            cards: [],
            // Paleta light + terracota (#C05A40). Card blanca con borde gris e ícono terracota suave.
            colors: {
                titleC:    '#111827',
                subC:      '#6B7280',
                cardBg:    '#FFFFFF',
                cardHover: '#F9FAFB',
                iconBg:    '#FBEAE5',  // terracota muy suave
                iconC:     '#C05A40',  // ícono terracota
                inputBg:   '#FFFFFF',
                inputBd:   '#E5E7EB',
                kbdBg:     '#F3F4F6',
                kbdC:      '#6B7280',
                cardBd:    '#E5E7EB',
            },
            font: 'poppins', // clase .font-poppins definida en la página (carga Poppins)
        };

        const o = this.options;
        const s = Object.assign({}, defaults, o);
        s.header        = Object.assign({}, defaults.header,        o.header || {});
        s.header.search = Object.assign({}, defaults.header.search, (o.header || {}).search || {});
        s.grid          = Object.assign({}, defaults.grid,          o.grid   || {});
        s.colors        = Object.assign({}, defaults.colors,        o.colors || {});
        return s;
    }

    init() {
        this.settings = this.buildSettings();
        this.render();
        this.bindEvents();
        return this;
    }

    render() {
        const s = this.settings;

        const $wrapper = $('<div>', {
            id:    this.uid + '_wrapper',
            class: 'w-full flex flex-col gap-4',
        });

        if (s.header.show) {
            $wrapper.append(this.buildHeader(s));
        }

        const $grid = $('<div>', {
            id:    this.uid + '_grid',
            class: `w-full grid ${s.grid.cols} ${s.grid.gap} content-start auto-rows-min`,
        });

        $wrapper.append($grid);
        $(this.parent).html($wrapper);

        this.renderCards(s);
        return this;
    }

    buildHeader(s) {
        const h = s.header;

        const $col = $('<div>', { class: 'flex flex-col min-w-0' });

        const $title = $('<h2>', {
            class: 'text-xl md:text-2xl font-semibold leading-tight',
            html:  h.title,
        }).css('color', s.colors.titleC);

        $col.append($title);

        if (h.subtitle) {
            $col.append(
                $('<p>', {
                    class: 'text-xs md:text-sm mt-1',
                    html:  h.subtitle,
                }).css('color', s.colors.subC)
            );
        }

        const $header = $('<div>', {
            id:    this.uid + '_header',
            class: 'w-full px-1 py-2 flex items-start justify-between gap-4 flex-wrap',
        }).append($col);

        if (h.search && h.search.show) {
            $header.append(this.buildSearch(s));
        }

        return $header;
    }

    buildSearch(s) {
        const h = s.header;

        const $icon = $('<span>', {
            class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400',
            html: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
                  'd="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"/></svg>',
        });

        const $input = $('<input>', {
            id:          this.uid + '_search',
            type:        'text',
            placeholder: h.search.placeholder,
            class:       `${h.search.width} pl-9 pr-14 py-2 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C05A40]/30`,
        }).css({
            'background-color': s.colors.inputBg,
            'border':           `1px solid ${s.colors.inputBd}`,
        });

        const $kbd = $('<kbd>', {
            class: 'absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded',
            text:  h.search.shortcut,
        }).css({
            'background-color': s.colors.kbdBg,
            'color':            s.colors.kbdC,
        });

        return $('<div>', { class: 'relative flex-shrink-0' }).append($icon, $input, $kbd);
    }

    renderCards(s) {
        const $grid = $('#' + this.uid + '_grid');
        $grid.empty();
        if (!(s.cards || []).length) {
            $grid.append(
                $('<div>', {
                    class: 'col-span-full text-sm text-gray-400 px-1 py-8 text-center',
                    text:  'No hay elementos para mostrar.',
                })
            );
            return;
        }
        (s.cards || []).forEach((item, idx) => {
            $grid.append(this.buildCard(item, idx, s));
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    buildCard(item, idx, s) {
        // --- Ícono (cuadro redondeado) ---
        let $icon;
        if (item.imagen) {
            $icon = $('<img>', {
                class: `w-10 h-10 ${item.padding || ''} rounded-lg p-1`,
                src:   item.imagen,
                alt:   item.titulo || '',
            }).css('background-color', s.colors.iconBg);
        } else if (item.icon) {
            $icon = $('<div>', {
                class: 'w-10 h-10 rounded-lg flex items-center justify-center',
                html:  `<i data-lucide="${item.icon}" class="w-5 h-5"></i>`,
            }).css({ 'background-color': s.colors.iconBg, 'color': s.colors.iconC });
        } else {
            $icon = $('<div>', { class: 'w-10 h-10 rounded-lg' }).css('background-color', s.colors.iconBg);
        }

        // --- Badge superior derecho (verde por defecto, estilo "ACTIVO") ---
        const $iconRow = $('<div>', { class: 'flex justify-between items-start' }).append($icon);
        if (item.badge) {
            $iconRow.append(
                $('<span>', {
                    class: 'text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full',
                    text:  item.badge.text,
                }).css({
                    'background-color': item.badge.bg    || '#DCFCE7',
                    'color':            item.badge.color || '#16A34A',
                })
            );
        }

        // --- Título + descripción ---
        const $title = $('<h2>', {
            class: `text-sm md:text-base font-semibold font-${s.font} leading-tight`,
            html:  item.titulo || '',
        }).css('color', s.colors.titleC);

        const $desc = $('<p>', {
            class: `text-xs font-${s.font} leading-snug line-clamp-2`,
            html:  item.descripcion || '',
        }).css('color', s.colors.subC);

        const $content = $('<div>', { class: 'mt-auto pt-2 flex flex-col gap-1' }).append($title, $desc);

        // --- Pie "Abrir... ->" visible solo en hover ---
        let $footer = '';
        if (item.footer) {
            $footer = $('<div>', {
                class: 'mt-2 flex items-center gap-1 text-xs font-semibold opacity-0 -translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0',
                html:  `<span>${item.footer}</span><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>`,
            }).css('color', s.colors.iconC);
            $content.append($footer);
        }

        return $('<div>', {
            class:        `module-card-item group w-full ${s.grid.height} rounded-xl shadow-sm p-3 flex flex-col cursor-pointer transition duration-300 hover:-translate-y-0.5 hover:shadow-md`,
            'data-idx':   idx,
            'data-title': (item.titulo || '').toLowerCase(),
        }).css({
            'background-color': s.colors.cardBg,
            'border':           `1px solid ${s.colors.cardBd}`,
        }).append($iconRow, $content);
    }

    bindEvents() {
        const uid  = this.uid;
        const ns   = '.' + uid;
        const self = this;

        $(document)
            .off('click' + ns)
            .on('click' + ns, '#' + uid + '_grid .module-card-item', function (e) {
                const idx  = parseInt($(this).data('idx'), 10);
                const item = self.settings.cards[idx];
                if (!item) return;
                if (typeof item.onClick === 'function') return item.onClick(item, e);
                if (item.enlace) window.location.href = item.enlace;
            });

        const $input = $('#' + uid + '_search');

        $input.off('input' + ns).on('input' + ns, function () {
            const q = $(this).val().trim().toLowerCase();
            self.filter(q);
            if (typeof self.searchCb === 'function') self.searchCb(q);
        });

        $(document).off('keydown' + ns).on('keydown' + ns, function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                $input.focus();
            }
        });

        return this;
    }

    // --- Public API ---

    filter(query) {
        const q = (query || '').toLowerCase().trim();
        $('#' + this.uid + '_grid .module-card-item').each(function () {
            const t = $(this).data('title') || '';
            if (!q || String(t).includes(q)) $(this).removeClass('hidden');
            else                              $(this).addClass('hidden');
        });
        return this;
    }

    setCards(cards) {
        this.settings.cards = cards || [];
        this.renderCards(this.settings);
        return this;
    }

    setTitle(title) {
        this.settings.header.title = title;
        $('#' + this.uid + '_header h2').first().html(title);
        return this;
    }

    setSubtitle(subtitle) {
        this.settings.header.subtitle = subtitle;
        $('#' + this.uid + '_header p').first().html(subtitle);
        return this;
    }

    onSearch(cb) {
        this.searchCb = cb;
        return this;
    }
}
