// -- Pestaña Productos --
// Las globales (products, dataInit) y los ayudantes (notify, afterSave, saveFrom, esc) viven en catalogo.js.
// Inventario (propuesta B, 28/11/2026): la ficha trae toda su sección (unidad,
// vida útil, área, mínimo, máximo y lotes). La tabla solo dice si lo lleva:
// se marca en la ficha o en Inventarios › Catálogo de insumos.

class Products extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Products';
        this.tab = 'products';
        this.categories = [];
        this.origins = [];
        this.inventoryFilter = [];
        this.isMain = true;
        this.mainName = '';
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    async render() {
        if ($('#filterBarProducts').length) return;

        this.layout();
        await this.loadFilter();
        this.filterBar();
        this.ls();
    }

    // App la llama al volver a la pestaña: en Categorías o Paquetes pudieron cambiar cosas.
    async reopen() {
        // render() sigue esperando las opciones: él termina de pintar.
        if (!$('#prod_active').length) return;

        const category  = $('#prod_category_id').val();
        const active    = $('#prod_active').val();
        const origin    = $('#prod_origin').val();
        const inventory = $('#prod_inventory').val();

        await this.loadFilter();
        this.filterBar();
        this.restoreFilter('prod_category_id', category);
        this.restoreFilter('prod_active', active);
        this.restoreFilter('prod_origin', origin);
        this.restoreFilter('prod_inventory', inventory);
        this.ls();
    }

    layout() {
        $('#container-products').html(`
            <div id="filterBarProducts" class="mb-[8px]"></div>
            <div id="containerProducts"></div>
        `);

        // Clic en la foto de la tabla: la vista previa en grande. El cuadro vacío no abre nada.
        $('#container-products')
            .off('click.preview')
            .on('click.preview', '#containerProducts img.cp-foto', (e) => this.preview(e.currentTarget));
    }

    // -- Vista previa de la foto --

    // Nombre y SKU salen de la misma celda (photoPreview, foto-producto.js).
    preview(img) {
        photoPreview(this, img);
    }

    // -- Filtro --

    // Si la petición falla se quedan las opciones que ya había.
    async loadFilter() {
        const response = await useFetch({ url: this._link, data: { opc: 'init' } });

        if (!response || response.status != 200) return;

        this.categories      = response.categories || [];
        this.origins         = response.origins || [];
        this.inventoryFilter = response.inventory || [];
        this.isMain          = response.isMain !== false;
        this.mainName        = response.main || '';
    }

    originFilter() {
        if (this.isMain) return [];

        return [{
            opc: 'select',
            id: 'origin',
            lbl: 'Origen',
            required: false,
            class: 'col-12 col-lg-2',
            data: this.origins,
            onchange: 'products.ls()'
        }];
    }

    // Si la opción ya no existe, el select se queda en la primera.
    restoreFilter(id, value) {
        const select = $(`#${id}`);

        if (select.find('option').filter((_, option) => option.value === value).length) select.val(value);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarProducts',
            id: 'fbProducts',
            prefijo: 'prod_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'category_id',
                    lbl: 'Categoría',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todas' }, ...this.categories],
                    onchange: 'products.ls()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'products.ls()'
                },
                {
                    opc: 'select',
                    id: 'inventory',
                    lbl: 'Inventario',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: this.inventoryFilter,
                    onchange: 'products.ls()'
                },
                ...this.originFilter(),
                {
                    opc: 'button',
                    id: 'btnNewProduct',
                    class: 'col-12 col-lg-2',
                    text: 'Nuevo producto',
                    onClick: () => this.add()
                }
            ]
        });
    }

    // Columnas: Producto, Origen, Categoría, Tipo, Precio, Costo, Canales, Inventario, Estado.
    ls() {
        this.createTable({
            parent: 'containerProducts',
            idFilterBar: 'filterBarProducts',
            data: { opc: 'lsProducts' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbProducts',
                theme: 'light',
                f_size: 12,
                design: 'flowbite',
                striped: true,
                right: [5, 6],
                center: [4, 7, 8, 9]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    // Opciones del modal, o null si la petición falló (ya avisó). keep: el producto al editar.
    async formOptions(keep = {}) {
        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'formOptions',
                keep_category_id: keep.category_id || 0,
                keep_subcategory_id: keep.subcategory_id || 0
            }
        });

        if (!response || response.status != 200) {
            notify(response);
            return null;
        }

        return {
            categories: response.categories || [],
            subcategories: response.subcategories || [],
            kinds: response.kinds || [],
            units: response.units || [],
            areas: response.areas || []
        };
    }

    // Sin categoría no hay subcategorías que ofrecer.
    subcategoriesOf(list, categoryId) {
        if (!categoryId) return [];

        return list.filter((s) => String(s.category_id) === String(categoryId));
    }

    /*  Dos columnas (layoutColumns): a la izquierda qué es el producto y dónde
        se vende; a la derecha, desde secPrice, el precio y el inventario. */
    jsonForm(options, row = {}) {
        const data = {
            name: '', kind: 'product', sku: '', barcode: '', category_id: '', subcategory_id: '',
            price: '', cost: '', description: '', sell_pos: 1, in_catalog: 0, is_inventoriable: 0,
            unit_id: '', shelf_life_days: '', warehouse_area_id: '', stock_min: '', stock_max: '', track_lots: 0,
            ...row
        };
        const third = 'w-full sm:w-1/3';
        const half  = 'w-full sm:w-1/2';

        return [
            // -- Columna izquierda --
            // Nombre, categoría y subcategoría van junto a la foto (layoutIdentity).
            { id: 'name', lbl: 'Nombre', tipo: 'text', icon: 'package', required: true, maxlength: 255, class: 'w-full', value: data.name },
            { id: 'category_id', lbl: 'Categoría', tipo: 'select', empty: 'Sin categoría', class: half, data: options.categories, value: data.category_id },
            {
                id: 'subcategory_id', lbl: 'Subcategoría', tipo: 'select', empty: 'Sin subcategoría', class: half,
                data: this.subcategoriesOf(options.subcategories, data.category_id), value: data.subcategory_id
            },
            { id: 'kind', lbl: 'Tipo', tipo: 'select', empty: false, class: third, data: options.kinds, value: data.kind },
            { id: 'sku', lbl: 'SKU', tipo: 'text', icon: 'hash', maxlength: 80, ph: 'Opcional', class: third, value: data.sku },
            { id: 'barcode', lbl: 'Código de barras', tipo: 'text', icon: 'barcode', maxlength: 80, ph: 'Opcional', class: third, value: data.barcode },
            { id: 'photoField', tipo: 'html', class: 'w-full', html: photoFieldHtml() },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 1000, class: 'w-full', value: data.description },

            // cp-switch: tarjetas del mismo alto aunque el texto de una ocupe dos renglones.
            this.formSection('secChannels', 'Se vende en'),
            { id: 'sell_pos', lbl: 'POS', tipo: 'switch', class: `${half} cp-switch`, value: data.sell_pos },
            { id: 'in_catalog', lbl: 'Catálogo en línea', tipo: 'switch', class: `${half} cp-switch`, value: data.in_catalog },

            // -- Columna derecha --
            this.formSection('secPrice', 'Precio'),
            { id: 'price', lbl: 'Precio de venta', tipo: 'number', icon: 'dollar-sign', required: true, min: 0, step: '0.01', ph: '0.00', class: half, value: data.price },
            { id: 'cost', lbl: 'Costo', tipo: 'number', icon: 'dollar-sign', min: 0, step: '0.01', ph: '0.00', class: half, value: data.cost },

            // Todo lo que usa Inventarios. Sin «Lleva inventario» el área, el mínimo,
            // el máximo y los lotes se guardan pero no se usan (bindInventory los apaga).
            // «Lleva inventario» sube al renglón del título (layoutColumns).
            this.formSection('secInventory', 'Inventario'),
            { id: 'is_inventoriable', lbl: 'Lleva inventario', tipo: 'switch', class: 'cp-inv-switch', value: data.is_inventoriable },
            { id: 'unit_id', lbl: 'Unidad', tipo: 'select', empty: 'Sin unidad', class: half, data: options.units, value: data.unit_id },
            { id: 'warehouse_area_id', lbl: 'Dónde se guarda', tipo: 'select', empty: 'Sin área', class: half, data: options.areas, value: data.warehouse_area_id },
            { id: 'shelf_life_days', lbl: 'Vida útil (días)', tipo: 'number', min: 0, step: '1', ph: 'Opcional', class: third, value: data.shelf_life_days },
            { id: 'stock_min', lbl: 'Mínimo', tipo: 'number', min: 0, step: '0.001', ph: '0', class: third, value: data.stock_min },
            { id: 'stock_max', lbl: 'Máximo', tipo: 'number', min: 0, step: '0.001', ph: 'Sin máximo', class: third, value: data.stock_max },
            { id: 'track_lots', lbl: 'Lote y caducidad', tipo: 'switch', class: 'w-full cp-switch', value: data.track_lots }
        ];
    }

    // Título de sección: un bloque 'html' de csModal, no viaja en los values.
    formSection(id, text) {
        return { id, tipo: 'html', class: 'w-full cp-seccion', html: `<p>${esc(text)}</p>` };
    }

    // Foto a la izquierda; nombre, categoría y subcategoría a su lado (photoBeside, foto-producto.js).
    layoutIdentity() {
        photoBeside('modalProduct', ['name', 'category_id', 'subcategory_id']);
    }

    /*  Parte el cuerpo de csModal en dos columnas: todo lo que va desde
        secPrice pasa al panel de la derecha. Solo mueve nodos: al guardar,
        csModal lee cada campo por su #id. Cada columna es flex-wrap para que
        bindInventory siga hallando el contenedor con .closest('.flex-wrap > div'). */
    layoutColumns(options) {
        const body  = $('#modalProduct .cs-modal-panel > .flex-wrap').first();
        const right = body.children('#secPrice').nextAll().addBack();

        const side = $('<div class="cp-cols-lado flex flex-wrap content-start"></div>').append(right);
        const main = $('<div class="cp-cols-main flex flex-wrap content-start"></div>').append(body.children());

        body.addClass('cp-cols').append(main, side);

        // «Lleva inventario» en el renglón del título Inventario, a la derecha.
        const head = $('<div class="w-full cp-inv-head"></div>').insertBefore(side.children('#secInventory'));

        head.append(side.children('#secInventory'), side.find('#is_inventoriable').closest('.cp-inv-switch'));
        head.find('.cp-inv-switch label').attr('title', 'Se descuenta del almacén al venderse');

        // Sin áreas, la pista va al pasar el ratón: como texto de ayuda descuadraba el renglón.
        if (!options.areas.length) {
            $('#modalProduct #warehouse_area_id').attr('title', 'Las áreas se dan de alta en Inventarios › Catálogo de insumos.');
        }
    }

    // Al cambiar la categoría, la subcategoría solo ofrece las suyas.
    bindCategory(subcategories) {
        $('#modalProduct').on('change', '#category_id', (e) => {
            const options = this.subcategoriesOf(subcategories, $(e.currentTarget).val())
                .map((s) => `<option value="${esc(s.id)}">${esc(s.valor)}</option>`)
                .join('');

            $('#modalProduct #subcategory_id').html(`<option value="">Sin subcategoría</option>${options}`);
        });
    }

    /*  Un servicio no se cuenta: se apaga «Lleva inventario» y no se deja
        prender. Sin inventario, el área, el mínimo, el máximo y los lotes se
        ven tenues y no se tocan (el ctrl tampoco los guarda). */
    bindInventory() {
        const modal  = $('#modalProduct');
        const fields = '#warehouse_area_id, #stock_min, #stock_max, #track_lots';

        const sync = () => {
            const service = modal.find('#kind').val() === 'service';

            if (service) modal.find('#is_inventoriable').prop('checked', false);

            modal.find('#is_inventoriable').prop('disabled', service);

            const on = modal.find('#is_inventoriable').is(':checked');

            modal.find(fields).prop('disabled', !on).closest('.flex-wrap > div').toggleClass('cp-off', !on);
        };

        modal.on('change', '#kind, #is_inventoriable', sync);
        sync();
    }

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalProduct',
            title: 'Nuevo producto',
            subtitle: 'Algo que se vende en caja o en el catálogo en línea',
            lucideIcon: 'package-plus',
            width: 'max-w-6xl',
            json: this.jsonForm(options),
            onSave: (values, close) => this.save('addProduct', values, close)
        });

        this.layoutColumns(options);
        this.layoutIdentity();
        this.bindCategory(options.subcategories);
        this.bindInventory();
        this.photo = mountPhoto('modalProduct');
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getProduct', id } });

        if (!response || response.status != 200) return notify(response);

        const options = await this.formOptions(response.data);

        if (!options) return;

        this.csModal({
            id: 'modalProduct',
            title: 'Editar producto',
            subtitle: this.isMain
                ? 'Lo que cambies aquí lo ven las sucursales que no tienen el suyo'
                : 'Cambia sus datos, su precio, dónde se vende o su inventario',
            lucideIcon: 'package-plus',
            width: 'max-w-6xl',
            json: this.jsonForm(options, response.data),
            onSave: (values, close) => this.save('editProduct', { ...values, id }, close)
        });

        this.layoutColumns(options);
        this.layoutIdentity();
        this.bindCategory(options.subcategories);
        this.bindInventory();
        this.photo = mountPhoto('modalProduct', response.data.image);
    }

    // Vacío vale (se guarda 0); lo demás debe ser un número no negativo.
    badAmount(value) {
        return String(value).trim() !== '' && !(Number(value) >= 0);
    }

    save(opc, values, close) {
        const warn  = (text) => warnBox(text);
        const price = String(values.price || '').trim();
        const max   = String(values.stock_max || '').trim();

        if (!String(values.name || '').trim()) return warn('Escribe el nombre del producto.');
        if (price === '' || !(Number(price) >= 0)) return warn('Escribe el precio de venta: un número mayor o igual a 0.');
        if (this.badAmount(values.cost)) return warn('El costo debe ser un número mayor o igual a 0.');
        if (values.subcategory_id && !values.category_id) return warn('Elige primero la categoría de la subcategoría.');

        if (Number(values.is_inventoriable) === 1) {
            if (this.badAmount(values.stock_min) || this.badAmount(max)) return warn('El mínimo y el máximo deben ser números mayores o iguales a 0.');
            if (max !== '' && Number(max) > 0 && Number(max) < Number(values.stock_min || 0)) return warn('El máximo debe ser mayor que el mínimo (o 0 para no tener máximo).');
        }

        return saveFrom('modalProduct', async () => {
            const response = await useFetch({ url: this._link, data: { opc, ...values, ...this.photo } });

            if (response && response.status == 200) {
                close();
                afterSave(response, () => this.ls());
            } else {
                notify(response);
            }
        });
    }

    status(id, active) {
        const off = this.isMain
            ? 'Dejará de venderse aquí y en las sucursales que no tienen el suyo. No se borra.'
            : 'Dejará de venderse. No se borra.';

        confirmSend(this, {
            title: active ? '¿Activar el producto?' : '¿Desactivar el producto?',
            text: active ? 'Volverá a venderse.' : off,
            danger: !active,
            data: { opc: 'statusProduct', id, active },
            done: (response) => afterSave(response, () => this.ls())
        });
    }

    // -- Compartido / Propio --

    copy(id) {
        confirmSend(this, {
            title: '¿Hacerlo propio de esta sucursal?',
            text: 'Se copia con su precio y su categoría. Lo que le cambies aquí no toca la Matriz.',
            data: { opc: 'copyProduct', id },
            done: (response) => afterSave(response, () => {
                this.ls();
                if (response.id) this.edit(response.id);
            })
        });
    }

    backToMain(id) {
        const main = this.mainName ? `la Matriz (${this.mainName})` : 'la Matriz';

        confirmSend(this, {
            title: '¿Volver al de la Matriz?',
            text: `Tu versión se desactiva (no se borra) y se vende la de ${main}, con su precio.`,
            data: { opc: 'statusProduct', id, active: 0 },
            done: (response) => afterSave(response, () => this.ls())
        });
    }
}
