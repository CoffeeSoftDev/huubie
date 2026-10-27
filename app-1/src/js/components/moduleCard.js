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
                    placeholder: 'Buscar modulo, producto o pedido...',
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
            colors: {
                titleC:    '#FFFFFF',
                subC:      '#9CA3AF',
                cardBg:    '#1F2A37',
                cardHover: '#273343',
                iconBg:    '#233876',
                inputBg:   '#111928',
                inputBd:   '#374151',
                kbdBg:     '#1F2937',
                kbdC:      '#9CA3AF',
            },
            font: '[Poppins]',
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
            class:       `${h.search.width} pl-9 pr-14 py-2 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40`,
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
        (s.cards || []).forEach((item, idx) => {
            $grid.append(this.buildCard(item, idx, s));
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    buildCard(item, idx, s) {
        const bgClass = item.bg || `bg-[${s.colors.cardBg}] hover:bg-[${s.colors.cardHover}]`;

        let $icon;
        if (item.imagen) {
            $icon = $('<img>', {
                class: `w-12 h-12 ${item.padding || ''} rounded-xl p-1`,
                src:   item.imagen,
                alt:   item.titulo || '',
            }).css('background-color', s.colors.iconBg);
        } else if (item.icon) {
            $icon = $('<div>', {
                class: 'w-12 h-12 rounded-xl flex items-center justify-center',
                html:  `<i data-lucide="${item.icon}" class="w-6 h-6 text-white"></i>`,
            }).css('background-color', s.colors.iconBg);
        } else {
            $icon = $('<div>', { class: 'w-12 h-12 rounded-xl' }).css('background-color', s.colors.iconBg);
        }

        const $iconRow = $('<div>', { class: 'flex justify-between items-start' }).append($icon);

        if (item.badge) {
            $iconRow.append(
                $('<span>', {
                    class: 'text-[10px] font-semibold px-2 py-1 rounded-full',
                    text:  item.badge.text,
                }).css({
                    'background-color': item.badge.bg    || '#7C3AED',
                    'color':            item.badge.color || '#fff',
                })
            );
        }

        const $title = $('<h2>', {
            class: `text-base md:text-lg font-semibold font-${s.font} leading-tight`,
            html:  item.titulo || '',
        }).css('color', s.colors.titleC);

        const $desc = item.descripcion
            ? $('<p>', {
                class: `text-xs md:text-sm font-${s.font} leading-snug line-clamp-2 min-h-[2.5rem]`,
                html:  item.descripcion,
              }).css('color', s.colors.subC)
            : $('<p>', { class: 'min-h-[2.5rem]' });

        const $content = $('<div>', { class: 'mt-auto flex flex-col gap-1' }).append($title, $desc);

        return $('<div>', {
            class:        `module-card-item w-full ${s.grid.height} ${bgClass} rounded-2xl shadow-md p-4 flex flex-col cursor-pointer transition duration-300 hover:scale-[1.02]`,
            'data-idx':   idx,
            'data-title': (item.titulo || '').toLowerCase(),
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
