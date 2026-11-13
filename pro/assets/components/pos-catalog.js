// -- CSS --

function posCatalogCSS() {
    if (document.getElementById('pos-catalog-css')) return;

    const css = ''
        + '.pos-cat{--po-surface:#FFF;--po-sunken:#F9FAFB;--po-line:#E5E7EB;--po-line-hi:#D1D5DB;--po-ink:#111827;--po-ink-2:#374151;--po-muted:#6B7280;--po-hover:#F3F4F6;'
        + '--po-brand:rgb(var(--brand-600,192 90 64));--po-brand-ink:rgb(var(--brand-700,160 72 51));--po-brand-soft:rgb(var(--brand-50,253 243 240));--po-brand-line:rgb(var(--brand-200,243 199 186));'
        + '--po-ring:rgb(var(--brand-600,192 90 64) / .18);--po-main:rgb(var(--primary-rgb,41 37 36));gap:10px;color:var(--po-ink)}'
        + 'body.dark-mode .pos-cat{--po-surface:var(--dk-card,#1F2A37);--po-sunken:var(--dk-sunken,#1a2332);--po-line:var(--dk-line,#374151);--po-line-hi:var(--dk-line-hi,#4B5563);--po-ink:var(--dk-text,#f5f5f5);--po-ink-2:#D1D5DB;'
        + '--po-muted:var(--dk-muted,#9CA3AF);--po-hover:var(--dk-row-hover,#334155);--po-brand-ink:rgb(var(--brand-200,243 199 186));--po-brand-soft:rgb(var(--brand-600,192 90 64) / .16);--po-brand-line:rgb(var(--brand-600,192 90 64) / .45)}'
        + '.pos-cat p{margin:0}'

        + '.pos-cat-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex-shrink:0}'
        + '.pos-cat-search{position:relative;flex:1 1 260px;min-width:0}'
        + '.pos-cat-search > svg{position:absolute;left:12px;top:50%;width:16px;height:16px;margin-top:-8px;color:var(--po-muted);pointer-events:none}'
        + 'input.pos-cat-q{display:block;width:100%;height:44px !important;margin:0;padding:0 64px 0 38px;border:1px solid var(--po-line-hi);border-radius:10px;background:var(--po-surface);color:var(--po-ink);font-size:14px;line-height:1.2;outline:none;transition:border-color .15s,box-shadow .15s}'
        + 'input.pos-cat-q::placeholder{color:var(--po-muted);opacity:1}'
        + 'input.pos-cat-q:focus{border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + '.pos-cat-kbd{position:absolute;right:10px;top:50%;display:inline-flex;align-items:center;height:18px;margin-top:-9px;padding:0 5px;border:1px solid var(--po-line-hi);border-radius:5px;background:var(--po-sunken);color:var(--po-muted);font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:nowrap;pointer-events:none}'
        + 'button.pos-cat-clear{position:absolute;right:8px;top:50%;display:none;align-items:center;justify-content:center;width:26px;height:26px;margin-top:-13px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--po-muted);cursor:pointer}'
        + 'button.pos-cat-clear:hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-cat-clear svg{width:15px;height:15px}'
        + '.pos-cat-search.has-text button.pos-cat-clear{display:inline-flex}'
        + '.pos-cat-search.has-text .pos-cat-kbd{display:none}'

        + '.pos-cat-actions{display:flex;gap:8px;flex-shrink:0}'
        + 'button.pos-cat-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:44px;padding:0 14px;border:1px solid var(--po-line-hi);border-radius:10px;background:var(--po-surface);color:var(--po-ink-2);font-size:13px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}'
        + 'button.pos-cat-action:hover{border-color:var(--po-brand-line);background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + 'button.pos-cat-action:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-cat-action svg{width:16px;height:16px;flex-shrink:0;color:var(--po-brand)}'

        + '.pos-cat-chips{display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0;max-height:120px;overflow-y:auto;scrollbar-width:thin}'
        + 'button.pos-cat-chip{display:inline-flex;align-items:center;gap:6px;height:36px;flex-shrink:0;padding:0 12px;border:1px solid var(--po-line);border-radius:10px;background:var(--po-surface);color:var(--po-ink-2);font-size:13px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s,opacity .15s}'
        + 'button.pos-cat-chip:hover{border-color:var(--po-line-hi);background:var(--po-hover)}'
        + 'button.pos-cat-chip:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-cat-chip svg{width:15px;height:15px;flex-shrink:0;color:var(--tone,var(--po-muted))}'
        + 'body.dark-mode button.pos-cat-chip svg{color:color-mix(in srgb,var(--tone,#9CA3AF) 60%,#fff)}'
        + 'button.pos-cat-chip small{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--po-hover);color:var(--po-muted);font-size:10.5px;font-weight:700}'
        + 'button.pos-cat-chip.is-on{border-color:var(--po-main);background:var(--po-main);color:#fff}'
        + 'button.pos-cat-chip.is-on svg{color:#fff}'
        + 'button.pos-cat-chip.is-on small{background:rgba(255,255,255,.18);color:#fff}'
        + 'body.dark-mode button.pos-cat-chip.is-on{border-color:#E5E7EB;background:#E5E7EB;color:#111827}'
        + 'body.dark-mode button.pos-cat-chip.is-on svg{color:#111827}'
        + 'body.dark-mode button.pos-cat-chip.is-on small{background:rgba(0,0,0,.1);color:#111827}'
        + '.pos-cat-chips.is-dim button.pos-cat-chip{opacity:.5}'

        + '.pos-cat-scroll{flex:1 1 0%;min-height:0;padding:2px 4px 4px 2px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}'
        + '.pos-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}'
        + 'button.pos-cat-card{position:relative;display:flex;flex-direction:column;min-width:0;padding:0;border:1px solid var(--po-line);border-radius:12px;background:var(--po-surface);color:var(--po-ink);text-align:left;overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .1s}'
        + 'button.pos-cat-card:hover{border-color:var(--po-line-hi);box-shadow:0 6px 18px -8px rgba(0,0,0,.25)}'
        + 'button.pos-cat-card:active{transform:scale(.985)}'
        + 'button.pos-cat-card:focus-visible{outline:none;border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-cat-card.is-off{display:none}'
        + '.pos-cat-top{position:relative;display:flex;align-items:center;justify-content:center;height:72px;flex-shrink:0;background:color-mix(in srgb,var(--tone,#9CA3AF) 9%,var(--po-surface))}'
        + 'body.dark-mode .pos-cat-top{background:color-mix(in srgb,var(--tone,#9CA3AF) 16%,var(--po-surface))}'
        + '.pos-cat-top svg{width:26px;height:26px;color:var(--tone,#6B7280)}'
        + 'body.dark-mode .pos-cat-top svg{color:color-mix(in srgb,var(--tone,#9CA3AF) 60%,#fff)}'
        + '.pos-cat-top img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s}'
        + '.pos-cat-top img.is-ready{opacity:1}'
        + '.pos-cat-body{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;padding:8px 10px 10px}'
        + '.pos-cat-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:2.6em;overflow:hidden;font-size:12.5px;font-weight:600;line-height:1.3;color:var(--po-ink)}'
        + '.pos-cat-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:auto}'
        + '.pos-cat-foot b{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--po-ink)}'
        + '.pos-cat-add{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0;border-radius:999px;background:var(--po-brand-soft);color:var(--po-brand-ink);transition:background-color .15s,color .15s}'
        + '.pos-cat-add svg{width:14px;height:14px}'
        + 'button.pos-cat-card:hover .pos-cat-add{background:var(--po-brand);color:#fff}'

        + '.pos-cat-empty{display:none;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:48px 16px;text-align:center;color:var(--po-muted)}'
        + '.pos-cat-empty.is-on{display:flex}'
        + '.pos-cat-empty svg{width:28px;height:28px;margin-bottom:6px;opacity:.7}'
        + '.pos-cat-empty-title{font-size:14px;font-weight:600;color:var(--po-ink-2)}'
        + '.pos-cat-empty-text{font-size:12.5px}'

        + '@media (max-width:1023px){'
        + '.pos-cat-chips{flex-wrap:nowrap;max-height:none;padding-bottom:2px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}'
        + '.pos-cat-chips::-webkit-scrollbar{display:none}'
        + '}'
        + '@media (max-width:639px){'
        + '.pos-cat-kbd{display:none}'
        + '.pos-cat-actions{width:100%}'
        + 'button.pos-cat-action{flex:1;min-width:0;padding:0 10px}'
        + '.pos-cat-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}'
        + '}';

    const style = document.createElement('style');

    style.id          = 'pos-catalog-css';
    style.textContent = css;

    document.head.appendChild(style);
}

// -- Componente --

Templates.prototype.posCatalog = function (options) {
    const defaults = {
        parent:     'root',
        id:         'posCatalog',
        class:      'flex-1 min-h-0 flex flex-col',
        json:       [],
        categories: [],
        actions:    [],
        search:     { placeholder: 'Buscar producto, SKU o código de barras' },
        empty:      { title: 'Sin productos', text: 'Prueba otra búsqueda o categoría.' },
        blank:      { title: 'Sin catálogo', text: 'Usa una línea libre o un pastel personalizado.' },
        onAdd:      () => { }
    };

    const opts  = Object.assign({}, defaults, options);
    const state = { category: '', text: '' };
    const items = [];
    const mac   = /Mac|iPhone|iPad/.test(navigator.platform || '');

    const plain = (text) => String(text == null ? '' : text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const icon  = (name) => $('<i>', { 'data-lucide': name, 'aria-hidden': 'true' });

    posCatalogCSS();

    const root       = $('<div>', { id: opts.id, class: `pos-cat ${opts.class}` });
    const bar        = $('<div>', { class: 'pos-cat-bar' });
    const search     = $('<div>', { class: 'pos-cat-search' });
    const input      = $('<input>', { id: `${opts.id}Search`, class: 'pos-cat-q', type: 'text', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: opts.search.placeholder, 'aria-label': opts.search.placeholder });
    const wipe       = $('<button>', { type: 'button', class: 'pos-cat-clear', 'aria-label': 'Limpiar búsqueda' }).append(icon('x'));
    const actions    = $('<div>', { class: 'pos-cat-actions' });
    const chips      = $('<div>', { id: `${opts.id}Chips`, class: 'pos-cat-chips' });
    const scroll     = $('<div>', { class: 'pos-cat-scroll' });
    const grid       = $('<div>', { id: `${opts.id}Grid`, class: 'pos-cat-grid' });
    const empty      = $('<div>', { id: `${opts.id}Empty`, class: 'pos-cat-empty' });
    const emptyTitle = $('<p>', { class: 'pos-cat-empty-title' });
    const emptyText  = $('<p>', { class: 'pos-cat-empty-text' });

    const matches = (item) => {
        if (state.text !== '') return item.words.includes(state.text);

        return state.category === '' || item.category === state.category;
    };

    const refresh = () => {
        const message = items.length ? opts.empty : opts.blank;
        let shown     = 0;

        items.forEach((item) => {
            const on = matches(item);

            item.el.toggleClass('is-off', !on);

            if (on) shown++;
        });

        search.toggleClass('has-text', state.text !== '');
        chips.toggleClass('is-dim', state.text !== '');
        emptyTitle.text(message.title);
        emptyText.text(message.text);
        empty.toggleClass('is-on', shown === 0);
        scroll.scrollTop(0);
    };

    const setText = (value) => {
        state.text = plain(value);
        refresh();
    };

    const clear = () => {
        input.val('');
        setText('');
    };

    const setCategory = (id) => {
        state.category = String(id);

        chips.children().each((i, el) => {
            $(el).toggleClass('is-on', $(el).attr('data-cat') === state.category);
        });

        clear();
    };

    const add = (item) => {
        if (item.el[0].animate) {
            item.el[0].animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
        }

        opts.onAdd(item.data);
    };

    const pick = () => {
        if (state.text === '') return;

        const exact = items.filter((item) => item.codes.includes(state.text));
        const found = exact.length === 1 ? exact : items.filter(matches);

        if (found.length !== 1) return;

        add(found[0]);
        clear();
    };

    const card = (data) => {
        const el   = $('<button>', { type: 'button', class: 'pos-cat-card', 'aria-label': `Agregar ${data.name}` });
        const top  = $('<span>', { class: 'pos-cat-top' }).append(icon(data.icon || 'package'));
        const body = $('<span>', { class: 'pos-cat-body' });
        const foot = $('<span>', { class: 'pos-cat-foot' });

        if (data.tone) el[0].style.setProperty('--tone', data.tone);

        if (data.image) {
            const img = $('<img>', { loading: 'lazy', alt: '', src: data.image });

            img.on('load', () => img.addClass('is-ready'));

            img.on('error', () => {
                if (data.imageFallback && img.attr('src') !== data.imageFallback) {
                    img.attr('src', data.imageFallback);
                    return;
                }

                img.remove();
            });

            top.append(img);
        }

        foot.append($('<b>', { text: data.price }), $('<span>', { class: 'pos-cat-add' }).append(icon('plus')));
        body.append($('<span>', { class: 'pos-cat-name', text: data.name }), foot);
        el.append(top, body);

        return el;
    };

    const chip = (data) => {
        const el = $('<button>', { type: 'button', class: 'pos-cat-chip', 'data-cat': String(data.id) });

        if (data.tone) el[0].style.setProperty('--tone', data.tone);

        el.append(icon(data.icon || 'tag'), $('<span>', { text: data.name }), $('<small>', { text: String(data.total) }));
        el.on('click', () => setCategory(data.id));

        return el;
    };

    opts.json.forEach((data) => {
        const item = {
            data:     data,
            el:       card(data),
            category: String(data.category_id == null ? '' : data.category_id),
            words:    plain([data.name, data.sku, data.barcode].filter(Boolean).join(' ')),
            codes:    [plain(data.sku), plain(data.barcode)].filter(Boolean)
        };

        item.el.on('click', () => add(item));

        items.push(item);
        grid.append(item.el);
    });

    opts.actions.forEach((action) => {
        const el = $('<button>', { type: 'button', class: 'pos-cat-action' });

        if (action.id) el.attr('id', action.id);

        el.append(icon(action.icon || 'plus'), $('<span>', { text: action.text }));
        el.on('click', () => action.onClick && action.onClick());

        actions.append(el);
    });

    if (opts.categories.length > 1) {
        chips.append(chip({ id: '', name: 'Todos', total: items.length, icon: 'layout-grid' }).addClass('is-on'));

        opts.categories.forEach((category) => chips.append(chip(category)));
    }

    search.append(icon('search'), input, wipe, $('<span>', { class: 'pos-cat-kbd', text: mac ? '⌘ K' : 'Ctrl K' }));
    bar.append(search);

    if (opts.actions.length) bar.append(actions);

    empty.append(icon(items.length ? 'search' : 'package'), emptyTitle, emptyText);
    scroll.append(grid, empty);
    root.append(bar);

    if (opts.categories.length > 1) root.append(chips);

    root.append(scroll);

    $(`#${opts.parent}`).html(root);

    input.on('input', () => setText(input.val()));

    input.on('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            pick();
            return;
        }

        if (e.key === 'Escape' && input.val() !== '') {
            e.stopPropagation();
            clear();
        }
    });

    wipe.on('click', () => {
        clear();
        input.trigger('focus');
    });

    $(document).off('keydown.posCatalog').on('keydown.posCatalog', (e) => {
        if (!document.getElementById(`${opts.id}Search`)) {
            $(document).off('keydown.posCatalog');
            return;
        }

        if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 'k') return;
        if (document.querySelector('.cs-modal-bg') || (window.Swal && Swal.isVisible())) return;

        e.preventDefault();
        input.trigger('focus').trigger('select');
    });

    refresh();

    if (window.lucide) lucide.createIcons({ root: root[0] });
};
