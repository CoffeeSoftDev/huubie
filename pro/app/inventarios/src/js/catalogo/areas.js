// -- Pestaña Áreas --
// Dónde se guarda cada cosa dentro del almacén (refrigerador, congelador,
// anaquel). La eligen las fichas en «Dónde se guarda».

class Areas extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Areas';
        this.tab = 'areas';
    }

    render() {
        if ($('#filterBarAreas').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-areas').html(`
            <div id="filterBarAreas" class="mb-[8px]"></div>
            <div id="containerAreas"></div>
        `);

        lucideOnDraw('container-areas');
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarAreas',
            id: 'fbAreas',
            prefijo: 'are_',
            coffeesoft: true,
            data: [
                statusFilterField('areas'),
                newButtonField('btnNuevaArea', 'Nueva área', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Área, Almacén, Descripción, Productos, Estado.
    ls() {
        this.createTable({
            parent: 'containerAreas',
            idFilterBar: 'filterBarAreas',
            data: { opc: 'lsAreas' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbAreas', [4, 5]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    async formOptions() {
        const response = await useFetch({ url: this._link, data: { opc: 'formOptions' } });

        if (!response || response.status != 200) {
            notify(response);
            return null;
        }

        return response;
    }

    // Al dar de alta, el almacén de la sucursal viene elegido.
    jsonForm(options, row = {}) {
        const list  = options.almacenes || [];
        const mine  = list.find((w) => String(w.branch_id) === String(options.branch_id)) || list[0] || {};
        const half  = 'w-full sm:w-1/2';

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', icon: 'map-pin', required: true, maxlength: 120, ph: 'Refrigerador, Congelador, Anaquel 1', class: 'w-full', value: row.name || '' },
            { id: 'warehouse_id', lbl: 'Almacén', tipo: 'select', empty: false, class: half, data: list, value: row.warehouse_id || mine.id || '' },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: half, value: row.color_hex || '#0369A1' },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Opcional', class: 'w-full', value: row.description || '' }
        ];
    }

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalArea',
            title: 'Nueva área',
            subtitle: 'Un lugar dentro del almacén',
            lucideIcon: 'map-pin',
            width: 'max-w-xl',
            json: this.jsonForm(options),
            onSave: (values, close) => this.save('addArea', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getArea', id } });

        if (!response || response.status != 200) return notify(response);

        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalArea',
            title: 'Editar área',
            subtitle: response.data.name,
            lucideIcon: 'map-pin',
            width: 'max-w-xl',
            json: this.jsonForm(options, response.data),
            onSave: (values, close) => this.save('editArea', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalArea', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del área.'));
    }

    status(id, active) {
        statusTab(this, 'statusArea', id, active, 'el área', 'Deja de ofrecerse en las fichas. Lo que ya estaba ahí la conserva. No se borra.');
    }
}
