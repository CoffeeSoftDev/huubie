// -- Pestaña Subcategorías --
// Las globales (subcategories, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class Subcategories extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Subcategories';
        this.tab = 'subcategories';
        this.categories = [];
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    async render() {
        if ($('#filterBarSubcategories').length) return;

        this.layout();
        await this.loadFilter();
        this.filterBar();
        this.ls();
    }

    // App la llama al volver a la pestaña: en Categorías pudieron crear o desactivar alguna.
    async reopen() {
        // render() sigue esperando las opciones: él termina de pintar.
        if (!$('#sub_active').length) return;

        const category = $('#sub_category_id').val();
        const active   = $('#sub_active').val();

        await this.loadFilter();
        this.filterBar();
        this.restoreFilter('sub_category_id', category);
        this.restoreFilter('sub_active', active);
        this.ls();
    }

    layout() {
        $('#container-subcategories').html(`
            <div id="filterBarSubcategories" class="mb-[8px]"></div>
            <div id="containerSubcategories"></div>
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
            parent: 'filterBarSubcategories',
            id: 'fbSubcategories',
            prefijo: 'sub_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'category_id',
                    lbl: 'Categoría',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todas' }, ...this.categories],
                    onchange: 'subcategories.ls()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'subcategories.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewSubcategory',
                    class: 'col-12 col-lg-2',
                    text: 'Nueva subcategoría',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {

        this.createTable({
            parent: 'containerSubcategories',
            idFilterBar: 'filterBarSubcategories',
            data: { opc: 'lsSubcategories' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbSubcategories',
                theme: 'light',
                striped: true,
                center: [4, 5]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    jsonForm(categories, row = {}) {
        return [
            { id: 'category_id', lbl: 'Categoría', tipo: 'select', required: true, class: 'w-full', data: categories, value: row.category_id },
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 80, class: 'w-full', value: row.name || '' },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 255, class: 'w-full', value: row.description || '' }
        ];
    }

    // Categorías para el modal, o null si la petición falló (ya avisó).
    async categoryOptions(keep_id = 0) {
        const response = await useFetch({ url: this._link, data: { opc: 'formOptions', keep_id } });

        if (!response || response.status != 200) {
            notify(response);
            return null;
        }

        return response.categories || [];
    }

    async add() {
        const categories = await this.categoryOptions();

        if (!categories) return;

        if (!categories.length) {
            warnBox('Primero crea una categoría en la pestaña Categorías.', 'message');
            return;
        }

        this.csModal({
            id: 'modalSubcategory',
            title: 'Nueva subcategoría',
            subtitle: 'Divide una categoría, por ejemplo Pasteles › De chocolate',
            lucideIcon: 'folder-tree',
            json: this.jsonForm(categories),
            onSave: (values, close) => this.save('addSubcategory', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getSubcategory', id } });

        if (!response || response.status != 200) return notify(response);

        const categories = await this.categoryOptions(response.data.category_id || 0);

        if (!categories) return;

        this.csModal({
            id: 'modalSubcategory',
            title: 'Editar subcategoría',
            subtitle: 'Cambia su nombre o muévela a otra categoría',
            lucideIcon: 'folder-tree',
            json: this.jsonForm(categories, response.data),
            onSave: (values, close) => this.save('editSubcategory', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        const warn = (text) => warnBox(text);

        if (!values.category_id) return warn('Elige la categoría de la subcategoría.');
        if (!String(values.name || '').trim()) return warn('Escribe el nombre de la subcategoría.');

        return saveFrom('modalSubcategory', async () => {
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
        confirmSend(this, {
            title: active ? '¿Activar la subcategoría?' : '¿Desactivar la subcategoría?',
            text: active ? 'Volverá a aparecer al clasificar productos.' : 'Dejará de aparecer al clasificar productos. No se borra.',
            danger: !active,
            data: { opc: 'statusSubcategory', id, active },
            done: (response) => afterSave(response, () => this.ls())
        });
    }
}
