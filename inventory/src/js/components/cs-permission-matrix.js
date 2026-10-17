// -- csPermissionMatrix --
// Matriz de permisos de un rol: secciones (agrupadas por módulo) por acciones,
// como la "Matriz de Permisos" del panel de referencia de Configuración. Una
// casilla por acción que exista en la sección; las que no aplican llevan guion.
// Abajo, la barra de cambios sin guardar (Descartar / Guardar), la del
// rolePermissions de alpha. En solo lectura las casillas no se mueven y arriba
// va el motivo.
//
// baseCode: código del tipo de acción del que dependen los demás (Ver). Marcar
// otra acción de la sección marca también esa; quitarla quita las demás.

Templates.prototype.csPermissionMatrix = function (options) {
    const defaults = {
        parent:   'root',
        id:       'csPermissionMatrix',
        json:     { types: [], modules: [] },
        readonly: false,
        baseCode: null,
        note:     '',
        users:    0,
        empty:    'No hay acciones que asignar.',
        onSave:   () => {}
    };

    const opts  = Object.assign({}, defaults, options);
    const types = (opts.json && opts.json.types) || [];
    const mods  = (opts.json && opts.json.modules) || [];

    // -- Estado --

    let base = new Set();
    mods.forEach((m) => m.sections.forEach((s) => s.actions.forEach((a) => { if (a.granted) base.add(a.id); })));
    let granted = new Set(base);

    const total   = () => mods.reduce((n, m) => n + m.sections.reduce((k, s) => k + s.actions.length, 0), 0);
    const pending = () => {
        let n = 0;
        granted.forEach((id) => { if (!base.has(id)) n++; });
        base.forEach((id) => { if (!granted.has(id)) n++; });
        return n;
    };

    // -- Interfaz --

    const container = $('<div>', { id: opts.id, class: 'flex flex-col gap-3' });

    if (opts.note) {
        container.append($('<div>', { class: 'flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800' }).append(
            $('<i>', { 'data-lucide': opts.readonly ? 'lock' : 'info', class: 'w-4 h-4 shrink-0 mt-px' }),
            $('<span>', { text: opts.note })
        ));
    }

    if (!mods.length || !types.length) {
        container.append($('<div>', { class: 'flex flex-col items-center justify-center text-center text-gray-400 py-10 gap-2' }).append(
            $('<i>', { 'data-lucide': 'shield-off', class: 'w-8 h-8 text-gray-300' }),
            $('<p>', { class: 'text-xs', text: opts.empty })
        ));
        $(`#${opts.parent}`).html(container);
        if (window.lucide) lucide.createIcons();
        return;
    }

    const counter  = $('<span>', { class: 'text-xs font-medium text-gray-500 shrink-0' });
    const baseType = opts.baseCode ? types.find((t) => t.code === opts.baseCode) : null;

    container.append($('<div>', { class: 'flex items-end justify-between gap-3' }).append(
        $('<div>').append(
            $('<p>', { class: 'text-sm font-semibold text-gray-800', text: 'Matriz de permisos' }),
            $('<p>', {
                class: 'text-xs text-gray-400',
                text: baseType
                    ? `Marca lo que el rol puede hacer en cada sección. Cualquier otra acción incluye «${baseType.name}».`
                    : 'Marca lo que el rol puede hacer en cada sección. Para entrar a una sección basta con una acción.'
            })
        ),
        counter
    ));

    const check = (attrs) => $('<input>', Object.assign({
        type:     'checkbox',
        class:    'w-4 h-4 accent-blue-600 align-middle ' + (opts.readonly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'),
        disabled: opts.readonly
    }, attrs));

    // Fondos: encabezados y celdas sin clase bg-* para que en página oscura les
    // apliquen los colores de tabla de dark-mode.css (--dk-th, --dk-row) como al
    // resto de las tablas; el claro va en línea, y su !important le gana en oscuro.
    // La franja del módulo sí lleva bg-gray-100, que dark-mode.css traduce.
    const head = $('<tr>').append($('<th>', {
        class: 'sticky left-0 z-10 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-3 py-2.5',
        css:   { backgroundColor: '#F9FAFB' },
        text:  'Sección'
    }));

    // Columnas angostas con el nombre partido en dos renglones ("Subir /
    // comprobante"): las nueve acciones caben junto a la lista de roles en una
    // laptop sin scroll horizontal.
    types.forEach((t) => {
        head.append($('<th>', {
            class: 'text-center text-[11px] font-semibold text-gray-500 px-1 py-2 leading-tight w-[54px] min-w-[50px]',
            css:   { backgroundColor: '#F9FAFB' },
            text:  t.name
        }));
    });

    const body = $('<tbody>');

    mods.forEach((m) => {
        body.append($('<tr>').append(
            $('<td>', { colspan: types.length + 1, class: 'bg-gray-100 border-t border-gray-200 px-3 py-2' }).append(
                $('<label>', { class: 'flex items-center gap-2 select-none ' + (opts.readonly ? '' : 'cursor-pointer') }).append(
                    check({ 'data-module': m.id, title: `Todo ${m.name}` }),
                    $('<i>', { 'data-lucide': m.icon || 'layout-grid', class: 'w-4 h-4 text-gray-500' }),
                    $('<span>', { class: 'text-sm font-semibold text-gray-800', text: m.name }),
                    $('<span>', { 'data-module-count': m.id, class: 'ml-auto text-[11px] font-medium text-gray-400' })
                )
            )
        ));

        m.sections.forEach((s) => {
            const tr = $('<tr>', { 'data-section-row': s.id, 'data-module-of': m.id });

            tr.append($('<td>', { class: 'sticky left-0 border-t border-gray-100 px-3 py-2', css: { backgroundColor: '#FFFFFF' } }).append(
                $('<label>', { class: 'flex items-center gap-2 min-w-[150px] select-none ' + (opts.readonly ? '' : 'cursor-pointer') }).append(
                    check({ 'data-section': s.id, title: `Todo ${s.name}` }),
                    $('<span>', { class: 'shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-500' })
                        .append($('<i>', { 'data-lucide': s.icon || 'square', class: 'w-3.5 h-3.5' })),
                    $('<span>', { class: 'text-[13px] font-medium text-gray-700 truncate', text: s.name })
                )
            ));

            types.forEach((t) => {
                const action = s.actions.find((a) => a.type_id === t.id);
                tr.append($('<td>', { class: 'text-center border-t border-gray-100 px-1 py-2' }).append(action
                    ? check({ 'data-perm': action.id, 'data-type': t.code || '', checked: granted.has(action.id), title: `${t.name} en ${s.name}`, 'aria-label': `${t.name} en ${s.name}` })
                    : $('<span>', { class: 'text-gray-300', text: '—' })
                ));
            });

            body.append(tr);
        });
    });

    const table = $('<table>', { class: 'w-full text-sm border-separate border-spacing-0' }).append(
        $('<thead>').append(head),
        body
    );

    container.append($('<div>', { class: 'overflow-x-auto border border-gray-200 rounded-xl bg-white' }).append(table));

    const bar = $('<div>', { class: 'hidden flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50' });
    const barText = $('<span>', { class: 'text-xs text-gray-500 flex-1 min-w-[180px]' });
    const btnDiscard = $('<button>', {
        type:  'button',
        class: 'px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-600 hover:bg-gray-100',
        text:  'Descartar'
    });
    const btnSave = $('<button>', {
        type:  'button',
        class: 'px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white disabled:opacity-60',
        text:  'Guardar permisos'
    });

    bar.append(barText, btnDiscard, btnSave);
    if (!opts.readonly) container.append(bar);

    // -- Lógica --

    const sync = (scope, selector) => {
        const boxes = scope.find('[data-perm]');
        const on    = boxes.filter(':checked').length;
        scope.find(selector).first().prop({
            checked:       boxes.length > 0 && on === boxes.length,
            indeterminate: on > 0 && on < boxes.length
        });
        return { on: on, total: boxes.length };
    };

    const refresh = () => {
        body.find('[data-section-row]').each((_i, row) => sync($(row), '[data-section]'));

        mods.forEach((m) => {
            const rows = body.find(`[data-module-of="${m.id}"]`);
            const all  = rows.find('[data-perm]');
            const on   = all.filter(':checked').length;
            body.find(`[data-module="${m.id}"]`).prop({
                checked:       all.length > 0 && on === all.length,
                indeterminate: on > 0 && on < all.length
            });
            body.find(`[data-module-count="${m.id}"]`).text(`${on} de ${all.length}`);
        });

        counter.text(`${granted.size} de ${total()} ${total() === 1 ? 'acción' : 'acciones'}`);

        const changes = pending();
        bar.toggleClass('hidden', changes === 0).toggleClass('flex', changes > 0);
        barText.empty().append(
            $('<b>', { class: 'text-gray-800', text: `${changes} ${changes === 1 ? 'cambio' : 'cambios'} sin guardar` }),
            document.createTextNode(` · ${opts.users === 1 ? 'afecta a 1 usuario' : `afecta a ${opts.users} usuarios`}`)
        );
    };

    const setBoxes = (boxes, on) => {
        boxes.each((_i, el) => {
            el.checked = on;
            const id = Number(el.getAttribute('data-perm'));
            if (on) granted.add(id); else granted.delete(id);
        });
    };

    // La acción base (Ver) va con las demás de su renglón: marcar otra la marca,
    // y quitarla quita las demás (sin Ver no se puede hacer nada en la sección).
    const followBase = (row, box) => {
        const base = row.find(`[data-type="${opts.baseCode}"]`);
        if (!base.length) return;

        if (box === base[0]) {
            if (!box.checked) setBoxes(row.find('[data-perm]').not(base), false);
        } else if (box.checked && !base[0].checked) {
            setBoxes(base, true);
        }
    };

    body.on('change', '[data-perm]', (e) => {
        const box = e.currentTarget;
        const id  = Number(box.getAttribute('data-perm'));
        if (box.checked) granted.add(id); else granted.delete(id);
        if (baseType) followBase($(box).closest('[data-section-row]'), box);
        refresh();
    });

    body.on('change', '[data-section]', (e) => {
        setBoxes($(e.currentTarget).closest('[data-section-row]').find('[data-perm]'), e.currentTarget.checked);
        refresh();
    });

    body.on('change', '[data-module]', (e) => {
        const id = e.currentTarget.getAttribute('data-module');
        setBoxes(body.find(`[data-module-of="${id}"] [data-perm]`), e.currentTarget.checked);
        refresh();
    });

    btnDiscard.on('click', () => {
        granted = new Set(base);
        body.find('[data-perm]').each((_i, el) => { el.checked = granted.has(Number(el.getAttribute('data-perm'))); });
        refresh();
    });

    btnSave.on('click', () => {
        btnSave.prop('disabled', true);
        opts.onSave(Array.from(granted), (saved) => {
            btnSave.prop('disabled', false);
            if (saved === false) return;
            base = new Set(granted);
            refresh();
        });
    });

    $(`#${opts.parent}`).html(container);
    refresh();
    if (window.lucide) lucide.createIcons();
};
