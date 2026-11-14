// -- Pestaña Categorías --
// Las globales (categories, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class Categories extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Categories';
        this.tab = 'categories';
    }

    // La pagina completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarCategories').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-categories').html(`
            <div id="filterBarCategories" class="mb-[8px]"></div>
            <div id="containerCategories"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarCategories',
            id: 'fbCategories',
            prefijo: 'cat_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'categories.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewCategory',
                    class: 'col-12 col-lg-2',
                    text: 'Nueva categoría',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {

        this.createTable({
            parent: 'containerCategories',
            idFilterBar: 'filterBarCategories',
            data: { opc: 'lsCategories' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbCategories',
                theme: 'light',
                striped: true,
                center: [3, 4, 5]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    jsonForm(row = {}) {
        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 255, class: 'w-full', value: row.name || '' },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 3, maxlength: 1000, class: 'w-full', value: row.description || '' }
        ];
    }

    add() {
        this.csModal({
            id: 'modalCategory',
            title: 'Nueva categoría',
            subtitle: 'Agrupa los productos de esta sucursal',
            lucideIcon: 'folder-plus',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addCategory', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getCategory', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalCategory',
            title: 'Editar categoría',
            subtitle: 'Cambia el nombre o la descripción',
            lucideIcon: 'folder-pen',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editCategory', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        if (!String(values.name || '').trim()) {
            warnBox('Escribe el nombre de la categoría.');
            return;
        }

        return saveFrom('modalCategory', async () => {
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
            title: active ? '¿Activar la categoría?' : '¿Desactivar la categoría?',
            text: active ? 'Volverá a aparecer en los formularios.' : 'Dejará de aparecer en los formularios. Sus productos no se borran.',
            danger: !active,
            data: { opc: 'statusCategory', id, active },
            done: (response) => afterSave(response, () => this.ls())
        });
    }
}
