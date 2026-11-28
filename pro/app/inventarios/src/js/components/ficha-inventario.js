// -- Ficha de inventario --
// La de un producto o un insumo: arriba lo que se ve y no se toca (foto,
// nombre, categoría, precio, costo) y abajo su sección Inventario. La abren
// Stock › «Abrir ficha» y Catálogo de insumos › Productos; las dos hablan con
// getFicha / saveFicha de su ctrl (fichaResponse en core-inventarios).
// «Lleva inventario», unidad y vida útil solo los cambia la sucursal dueña:
// en un producto de la Matriz salen sin poder tocarse.

Templates.prototype.invFicha = async function ({ url, id, onSaved = () => {} }) {
    const r = await useFetch({ url, data: { opc: 'getFicha', id } });

    if (!r || r.status !== 200) return this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo abrir la ficha') });

    const d = r.data;

    this.csModal({
        id:         'modalFicha',
        title:      d.name,
        subtitle:   d.kind === 'supply'
            ? 'Ficha del insumo · su nombre y su foto se cambian en Insumos'
            : 'Ficha del Catálogo de venta · aquí cambias su Inventario',
        lucideIcon: d.kind === 'supply' ? 'wheat' : 'package',
        width:      'max-w-2xl',
        json:       invFichaJson(r),
        onSave:     (values, close) => invFichaSave(this, { url, id, values, close, onSaved })
    });

    invFichaBind(d);
};

// La foto local que no está: se busca una vez en producción y, si tampoco, queda el cuadro vacío.
function invFichaPhotoError(img) {
    if (!img.dataset.fileFallback) {
        img.dataset.fileFallback = '1';
        img.src = 'https://huubie.com.mx' + new URL(img.src, location.origin).pathname;
        return;
    }

    $(img).replaceWith('<div class="inv-ficha-foto inv-ficha-foto--vacia"><i class="icon-cube"></i></div>');
}

function invFichaJson(r) {
    const d       = r.data;
    const supply  = d.kind === 'supply';
    const third   = 'w-full sm:w-1/3';
    const half    = 'w-full sm:w-1/2';
    const matriz  = d.own ? '' : 'Es de la Matriz: se cambia en la Matriz.';
    const meta    = supply
        ? ['Insumo', d.sku]
        : [d.category, d.sku, `Precio ${invMoney(d.price)}`, d.cost > 0 ? `Costo ${invMoney(d.cost)}` : ''];
    const photo   = d.image
        ? `<img src="${invEsc(d.image)}" alt="" class="inv-ficha-foto" onerror="invFichaPhotoError(this)">`
        : '<div class="inv-ficha-foto inv-ficha-foto--vacia"><i class="icon-cube"></i></div>';

    const json = [
        {
            id: 'fichaHead', tipo: 'html', class: 'w-full',
            html: `<div class="inv-ficha-head">${photo}<div class="min-w-0"><p class="inv-ficha-nombre">${invEsc(d.name)}</p>`
                + `<p class="inv-ficha-meta">${invEsc(meta.filter(Boolean).join(' · '))}</p></div></div>`
        },
        { id: 'secFichaInv', tipo: 'html', class: 'w-full inv-ficha-seccion', html: '<p>Inventario</p>' },
        supply ? null : {
            id: 'is_inventoriable', lbl: 'Lleva inventario: se descuenta del almacén al venderse', tipo: 'switch', class: 'w-full',
            value: d.is_inventoriable, disabled: !d.own, help: matriz
        },
        { id: 'unit_id', lbl: 'Unidad', tipo: 'select', empty: supply ? false : 'Sin unidad', class: third, data: r.units || [], value: d.unit_id, disabled: !d.own },
        { id: 'shelf_life_days', lbl: 'Vida útil (días)', tipo: 'number', icon: 'calendar-clock', min: 0, step: '1', ph: 'Opcional', class: third, value: d.shelf_life_days, disabled: !d.own },
        {
            id: 'warehouse_area_id', lbl: 'Dónde se guarda', tipo: 'select', empty: 'Sin área', class: third, data: r.areas || [], value: d.warehouse_area_id,
            help: (r.areas || []).length ? '' : 'Las áreas se dan de alta en Catálogo de insumos.'
        },
        { id: 'stock_min', lbl: 'Mínimo', tipo: 'number', icon: 'arrow-down-to-line', min: 0, step: '0.001', ph: '0', class: third, value: d.stock_min },
        { id: 'stock_max', lbl: 'Máximo', tipo: 'number', icon: 'arrow-up-to-line', min: 0, step: '0.001', ph: '0 = sin máximo', class: third, value: d.stock_max },
        { id: 'track_lots', lbl: 'Lote y caducidad', tipo: 'switch', class: third, value: d.track_lots },
        supply ? { id: 'supply_group_id', lbl: 'Grupo de insumos', tipo: 'select', empty: 'Sin grupo', class: half, data: r.groups || [], value: d.supply_group_id } : null,
        supply ? { id: 'supplier_id', lbl: 'Proveedor habitual', tipo: 'select', empty: 'Sin proveedor', class: half, data: r.suppliers || [], value: d.supplier_id } : null
    ];

    return json.filter(Boolean);
}

/*  Sin «Lleva inventario» el área, el mínimo, el máximo y los lotes se ven
    tenues y no se tocan. De la Matriz, el apagador tampoco se toca. */
function invFichaBind(d) {
    const modal  = $('#modalFicha');
    const fields = '#warehouse_area_id, #stock_min, #stock_max, #track_lots';
    const sync   = () => {
        if (d.kind === 'supply') return;

        const on = modal.find('#is_inventoriable').is(':checked');

        modal.find(fields).prop('disabled', !on).closest('.flex-wrap > div').toggleClass('inv-ficha-off', !on);
    };

    if (!d.own) modal.find('#is_inventoriable').prop('disabled', true);

    modal.on('change', '#is_inventoriable', sync);
    sync();
}

async function invFichaSave(owner, { url, id, values, close, onSaved }) {
    const min = String(values.stock_min || '').trim();
    const max = String(values.stock_max || '').trim();

    if ((min !== '' && !(Number(min) >= 0)) || (max !== '' && !(Number(max) >= 0))) {
        return owner.alertBox({ type: 'warning', title: 'El mínimo y el máximo deben ser números mayores o iguales a 0.' });
    }

    if (max !== '' && Number(max) > 0 && Number(max) < Number(min || 0)) {
        return owner.alertBox({ type: 'warning', title: 'El máximo debe ser mayor que el mínimo (o 0 para no tener máximo).' });
    }

    const $btn = $('#modalFicha .cs-modal-save');

    if ($btn.prop('disabled')) return;

    $btn.prop('disabled', true);

    const res = await useFetch({ url, data: Object.assign({ opc: 'saveFicha', id }, values) });

    $btn.prop('disabled', false);

    if (!res || res.status !== 200) return owner.alertBox({ type: 'error', title: invEsc((res && res.message) || 'No se pudo guardar') });

    close();
    owner.alertBox({ type: 'success', title: invEsc(res.message || 'Guardado'), timer: 1400 });
    onSaved(res);
}
