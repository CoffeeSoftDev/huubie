// -- Pestaña Productos --
// Las globales (products, dataInit) y los ayudantes (notify, afterSave, saveFrom, esc) viven en catalogo.js.

class Products extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Products';
        this.tab = 'products';
        this.categories = [];
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

        const category = $('#prod_category_id').val();
        const active   = $('#prod_active').val();

        await this.loadFilter();
        this.filterBar();
        this.restoreFilter('prod_category_id', category);
        this.restoreFilter('prod_active', active);
        this.ls();
    }

    layout() {
        $('#container-products').html(`
            <div id="filterBarProducts" class="mb-[8px]"></div>
            <div id="containerProducts"></div>
        `);
    }

    // -- Filtro --

    // Si la petición falla se quedan las opciones que ya había.
    async loadFilter() {
        const response = await useFetch({ url: this._link, data: { opc: 'init' } });

        if (response && response.status == 200) this.categories = response.categories || [];
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
                    class: 'col-12 col-md-3',
                    data: [{ id: '', valor: 'Todas' }, ...this.categories],
                    onchange: 'products.ls()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'products.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewProduct',
                    class: 'col-12 col-md-3 col-lg-2',
                    text: 'Nuevo producto',
                    onClick: () => this.add()
                }
            ]
        });
    }

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
                striped: true,
                right: [4, 5],
                center: [3, 6, 7]
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
            kinds: response.kinds || []
        };
    }

    // Sin categoría no hay subcategorías que ofrecer.
    subcategoriesOf(list, categoryId) {
        if (!categoryId) return [];

        return list.filter((s) => String(s.category_id) === String(categoryId));
    }

    jsonForm(options, row = {}) {
        const data = {
            name: '', kind: 'product', sku: '', barcode: '', category_id: '', subcategory_id: '',
            price: '', cost: '', description: '', sell_pos: 1, in_catalog: 0, is_inventoriable: 0,
            ...row
        };

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 255, class: 'w-full', value: data.name },
            { id: 'kind', lbl: 'Tipo', tipo: 'select', empty: false, class: 'w-full sm:w-1/3', data: options.kinds, value: data.kind },
            { id: 'sku', lbl: 'SKU', tipo: 'text', maxlength: 80, ph: 'Opcional', class: 'w-full sm:w-1/3', value: data.sku },
            { id: 'barcode', lbl: 'Código de barras', tipo: 'text', maxlength: 80, ph: 'Opcional', class: 'w-full sm:w-1/3', value: data.barcode },
            { id: 'category_id', lbl: 'Categoría', tipo: 'select', empty: 'Sin categoría', data: options.categories, value: data.category_id },
            {
                id: 'subcategory_id', lbl: 'Subcategoría', tipo: 'select', empty: 'Sin subcategoría',
                data: this.subcategoriesOf(options.subcategories, data.category_id), value: data.subcategory_id
            },
            { id: 'price', lbl: 'Precio de venta', tipo: 'number', required: true, min: 0, step: '0.01', ph: '0.00', value: data.price },
            { id: 'cost', lbl: 'Costo', tipo: 'number', min: 0, step: '0.01', ph: '0.00', value: data.cost },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 1000, class: 'w-full', value: data.description },
            { id: 'sell_pos', lbl: 'Se vende en el POS', tipo: 'switch', class: 'w-full sm:w-1/3', value: data.sell_pos },
            { id: 'in_catalog', lbl: 'Sale en el catálogo en línea', tipo: 'switch', class: 'w-full sm:w-1/3', value: data.in_catalog },
            { id: 'is_inventoriable', lbl: 'Lleva inventario', tipo: 'switch', class: 'w-full sm:w-1/3', value: data.is_inventoriable }
        ];
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

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalProduct',
            title: 'Nuevo producto',
            subtitle: 'Algo que se vende en caja o en el catálogo en línea',
            lucideIcon: 'package-plus',
            json: this.jsonForm(options),
            onSave: (values, close) => this.save('addProduct', values, close)
        });

        this.bindCategory(options.subcategories);
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getProduct', id } });

        if (!response || response.status != 200) return notify(response);

        const options = await this.formOptions(response.data);

        if (!options) return;

        this.csModal({
            id: 'modalProduct',
            title: 'Editar producto',
            subtitle: 'Cambia sus datos, su precio o dónde se vende',
            lucideIcon: 'package-plus',
            json: this.jsonForm(options, response.data),
            onSave: (values, close) => this.save('editProduct', { ...values, id }, close)
        });

        this.bindCategory(options.subcategories);
    }

    // Vacío vale (se guarda 0); lo demás debe ser un número no negativo.
    badAmount(value) {
        return String(value).trim() !== '' && !(Number(value) >= 0);
    }

    save(opc, values, close) {
        const warn = (text) => alert({ icon: 'warning', text, btn1: true });
        const price = String(values.price || '').trim();

        if (!String(values.name || '').trim()) return warn('Escribe el nombre del producto.');
        if (price === '' || !(Number(price) >= 0)) return warn('Escribe el precio de venta: un número mayor o igual a 0.');
        if (this.badAmount(values.cost)) return warn('El costo debe ser un número mayor o igual a 0.');
        if (values.subcategory_id && !values.category_id) return warn('Elige primero la categoría de la subcategoría.');

        return saveFrom('modalProduct', async () => {
            const response = await useFetch({ url: this._link, data: { opc, ...values } });

            if (response && response.status == 200) {
                close();
                afterSave(response, () => this.ls());
            } else {
                notify(response);
            }
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: active ? '¿Activar el producto?' : '¿Desactivar el producto?',
                text: active ? 'Volverá a venderse.' : 'Dejará de venderse. No se borra.'
            },
            data: { opc: 'statusProduct', id, active },
            methods: {
                send: (response) => afterSave(response, () => this.ls())
            }
        });
    }
}
