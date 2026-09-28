// -- csNavList · csGroupedList --
// Panel lateral de selección y lista agrupada en acordeones (arrastre para ordenar + interruptor).

function csGlSwitch(on, onClick) {
    const sw = $('<button>', {
        type: 'button',
        role: 'switch',
        'aria-checked': on ? 'true' : 'false',
        title: on ? 'Apagar' : 'Encender',
        class: 'shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition '
            + (on ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-300 hover:bg-gray-400')
    });

    sw.append($('<span>', {
        class: 'inline-block h-4 w-4 rounded-full bg-white shadow transform transition '
            + (on ? 'translate-x-4' : 'translate-x-0.5')
    }));

    sw.on('click', (e) => {
        e.stopPropagation();
        onClick();
    });

    return sw;
}

Templates.prototype.csNavList = function (options) {
    const defaults = {
        parent: 'root',
        id: 'csNavList',
        title: '',
        class: 'bg-white border border-gray-200 rounded-xl flex flex-col h-full min-h-0 overflow-hidden',
        json: [],
        active: null,
        addTitle: 'Agregar',
        onAdd: null,
        onSelect: () => { },
        onEdit: () => { },
        onToggle: () => { }
    };

    const opts = Object.assign({}, defaults, options);

    const container = $('<div>', {
        id: opts.id,
        class: opts.class
    });

    if (opts.title) {
        const header = $('<div>', {
            class: 'flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0'
        });

        header.append($('<span>', {
            class: 'text-sm font-semibold text-gray-800',
            text: opts.title
        }));

        if (typeof opts.onAdd === 'function') {
            const add = $('<button>', {
                type: 'button',
                title: opts.addTitle,
                class: 'w-7 h-7 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-blue-600'
            });

            add.append($('<i>', {
                'data-lucide': 'plus',
                class: 'w-4 h-4'
            }));

            add.on('click', () => opts.onAdd());
            header.append(add);
        }

        container.append(header);
    }

    const list = $('<div>', {
        class: 'flex flex-col gap-0.5 p-2 flex-1 min-h-0 overflow-y-auto'
    });

    opts.json.forEach((item) => {
        const selected = String(item.id) === String(opts.active);

        const row = $('<div>', {
            role: 'button',
            class: 'group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left cursor-pointer transition '
                + (selected ? 'bg-gray-100' : 'hover:bg-gray-50')
        });

        if (item.icon) {
            const icon = $('<span>', {
                class: 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg '
                    + (selected ? 'bg-blue-600/10 text-blue-600' : 'bg-gray-100 text-gray-500')
                    + (item.muted ? ' opacity-60' : '')
            });

            icon.append($('<i>', {
                'data-lucide': item.icon,
                class: 'w-4 h-4'
            }));

            row.append(icon);
        }

        const text = $('<div>', {
            class: 'min-w-0 flex-1' + (item.muted ? ' opacity-60' : '')
        });

        text.append($('<p>', {
            class: 'text-sm text-gray-800 truncate leading-tight ' + (selected ? 'font-semibold' : 'font-medium'),
            text: item.label
        }));

        const meta = $('<p>', {
            class: 'flex items-center flex-wrap gap-1 text-[11px] text-gray-400 mt-0.5'
        });

        if (item.meta) meta.append($('<span>', { text: item.meta }));

        if (item.tag) {
            meta.append($('<span>', {
                class: 'px-1.5 rounded bg-amber-50 text-amber-700 font-medium',
                text: item.tag
            }));
        }

        text.append(meta);
        row.append(text);

        if (item.editable) {
            const edit = $('<button>', {
                type: 'button',
                title: 'Editar',
                class: 'shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition'
            });

            edit.append($('<i>', {
                'data-lucide': 'pencil',
                class: 'w-3.5 h-3.5'
            }));

            edit.on('click', (e) => {
                e.stopPropagation();
                opts.onEdit(item);
            });

            row.append(edit);
        }

        if (item.switchable) {
            row.append(csGlSwitch(item.on, () => opts.onToggle(item)));
        } else if (selected) {
            row.append($('<i>', {
                'data-lucide': 'check',
                class: 'w-3.5 h-3.5 text-gray-900 shrink-0'
            }));
        }

        row.on('click', () => opts.onSelect(item));
        list.append(row);
    });

    container.append(list);

    $(`#${opts.parent}`).html(container);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

Templates.prototype.csGroupedList = function (options) {
    const defaults = {
        parent: 'root',
        id: 'csGroupedList',
        class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 overflow-y-auto p-2 flex flex-col gap-2',
        json: [],
        sortable: false,
        switchable: false,
        renamable: false,
        empty: {
            icon: 'inbox',
            title: 'Sin elementos',
            text: ''
        },
        onSelect: () => { },
        onSort: () => { },
        onToggle: () => { },
        onRename: () => { },
        onRenameItem: () => { },
        onDelete: () => { },
        onGroupToggle: () => { }
    };

    const opts = Object.assign({}, defaults, options);

    const container = $('<div>', {
        id: opts.id,
        class: opts.class
    });

    const buildEmpty = (empty) => {
        const box = $('<div>', {
            class: 'flex-1 flex flex-col items-center justify-center text-center py-14 px-6'
        });

        box.append($('<i>', {
            'data-lucide': empty.icon || 'inbox',
            class: 'w-8 h-8 text-gray-300 mb-2'
        }));

        box.append($('<p>', {
            class: 'text-sm font-medium text-gray-600',
            text: empty.title
        }));

        if (empty.text) {
            box.append($('<p>', {
                class: 'text-xs text-gray-400 mt-1 max-w-sm',
                text: empty.text
            }));
        }

        return box;
    };

    // Cambia `name` por un input; Enter o salir del campo guarda, Esc cancela.
    // detach/insert (no replaceWith) para que `name` conserve sus eventos al volver.
    const bindRename = (value, name, onSave, hide) => {
        const input = $('<input>', {
            type: 'text',
            value: value,
            class: 'min-w-0 w-full max-w-xs px-2 py-0.5 text-[13px] font-semibold text-gray-800 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/30'
        });

        let done = false;

        const finish = (save) => {
            if (done) return;
            done = true;

            const next = String(input.val() || '').trim();

            if (save && next && next !== value) {
                onSave(next);
                return;
            }

            name.insertBefore(input);
            input.remove();
            if (hide) hide.removeClass('hidden');
        };

        input.on('click dblclick mousedown', (e) => e.stopPropagation());

        input.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
            }
            if (e.key === 'Escape') finish(false);
        });

        input.on('blur', () => finish(true));

        input.insertAfter(name);
        name.detach();
        if (hide) hide.addClass('hidden');
        input.trigger('focus').trigger('select');
    };

    const buildRow = (item, group) => {
        const row = $('<div>', {
            class: 'cs-gl-row flex items-center gap-3 pr-3 py-2 border-t border-gray-100 cursor-pointer bg-white hover:bg-gray-50 '
                + (opts.sortable ? 'pl-2' : 'pl-9'),
            'data-id': item.id
        });

        if (opts.sortable) {
            const handle = $('<span>', {
                class: 'cs-gl-handle shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 cursor-grab active:cursor-grabbing',
                title: 'Arrastra para mover'
            });

            handle.append($('<i>', {
                'data-lucide': 'grip-vertical',
                class: 'w-4 h-4'
            }));

            handle.on('click', (e) => e.stopPropagation());
            row.append(handle);
        }

        if (item.icon) {
            const icon = $('<span>', {
                class: 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'
                    + (item.muted ? ' opacity-60' : '')
            });

            icon.append($('<i>', {
                'data-lucide': item.icon,
                class: 'w-4 h-4'
            }));

            row.append(icon);
        }

        const text = $('<div>', {
            class: 'min-w-0 flex-1'
        });

        const label = $('<div>', {
            class: item.muted ? 'opacity-60' : ''
        });

        const name = $('<p>', {
            class: 'text-[13px] font-medium text-gray-800 truncate',
            title: opts.renamable ? 'Doble clic para editar el nombre' : '',
            text: item.title
        });

        label.append(name);

        if (item.subtitle) {
            label.append($('<p>', {
                class: 'text-[11px] text-gray-400 font-mono truncate',
                text: item.subtitle
            }));
        }

        text.append(label);

        if (item.note) {
            text.append($('<p>', {
                class: 'mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1',
                text: item.note
            }));
        }

        row.append(text);

        if (item.deletable) {
            const del = $('<button>', {
                type: 'button',
                title: 'Eliminar',
                class: 'shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50'
            });

            del.append($('<i>', {
                'data-lucide': 'trash-2',
                class: 'w-4 h-4'
            }));

            del.on('click', (e) => {
                e.stopPropagation();
                opts.onDelete(item, group);
            });

            row.append(del);
        }

        if (opts.switchable) row.append(csGlSwitch(item.on, () => opts.onToggle(item, group)));

        // Con renombrado, el clic simple espera a ver si llega el doble clic.
        let clickTimer = null;

        row.on('click', () => {
            if (!opts.renamable) {
                opts.onSelect(item, group);
                return;
            }
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => opts.onSelect(item, group), 300);
        });

        if (opts.renamable) {
            name.on('dblclick', (e) => {
                e.stopPropagation();
                clearTimeout(clickTimer);
                bindRename(item.title, name, (value) => opts.onRenameItem(item, value, group));
            });
        }

        return row;
    };

    const buildGroup = (group) => {
        const open = group.open !== false;

        const block = $('<div>', {
            class: 'border border-gray-200 rounded-lg overflow-hidden shrink-0'
        });

        const head = $('<div>', {
            role: 'button',
            class: 'group w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer'
        });

        const title = $('<span>', {
            class: 'flex items-center gap-2 min-w-0 text-sm font-semibold text-gray-800'
        });

        title.append($('<i>', {
            'data-lucide': 'chevron-down',
            class: 'cs-gl-chevron w-3.5 h-3.5 text-gray-400 transition-transform shrink-0' + (open ? '' : ' -rotate-90')
        }));

        const name = $('<span>', {
            class: 'truncate' + (group.muted ? ' text-gray-500' : ''),
            text: group.title
        });

        title.append(name);

        if (group.editable) {
            const editBtn = $('<button>', {
                type: 'button',
                title: 'Editar nombre',
                class: 'shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition'
            });

            editBtn.append($('<i>', {
                'data-lucide': 'pencil',
                class: 'w-3.5 h-3.5'
            }));

            editBtn.on('click', (e) => {
                e.stopPropagation();
                bindRename(group.title, name, (value) => opts.onRename(group, value), editBtn);
            });

            title.append(editBtn);
        }

        if (group.tag) {
            title.append($('<span>', {
                class: 'px-1.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium shrink-0',
                text: group.tag
            }));
        }

        head.append(title);

        head.append($('<span>', {
            class: 'shrink-0 text-[11px] font-medium text-gray-400',
            text: group.count !== undefined ? group.count : group.items.length
        }));

        const body = $('<div>', {
            class: open ? '' : 'hidden'
        });

        if (group.items.length) {
            group.items.forEach((item) => body.append(buildRow(item, group)));
        } else {
            body.append($('<p>', {
                class: 'pl-9 pr-3 py-3 border-t border-gray-100 text-xs text-gray-400',
                text: group.emptyText || 'Sin elementos'
            }));
        }

        if (opts.sortable && group.items.length > 1 && typeof Sortable !== 'undefined') {
            Sortable.create(body[0], {
                handle: '.cs-gl-handle',
                draggable: '.cs-gl-row',
                animation: 150,
                ghostClass: 'opacity-40',
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    const ids = body.children('.cs-gl-row').map((_, el) => $(el).data('id')).get();
                    opts.onSort(group, ids);
                }
            });
        }

        head.on('click', () => {
            const isOpen = !body.hasClass('hidden');
            body.toggleClass('hidden', isOpen);
            head.find('.cs-gl-chevron').toggleClass('-rotate-90', isOpen);
            opts.onGroupToggle(group, !isOpen);
        });

        block.append(head, body);

        return block;
    };

    if (!opts.json.length) {
        container.append(buildEmpty(opts.empty));
    } else {
        opts.json.forEach((group) => container.append(buildGroup(group)));
    }

    $(`#${opts.parent}`).html(container);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
