// -- Pestaña Insumos --
// Lo que se compra y se cuenta pero no se vende (harina, leche, domos). La
// ficha trae identificación, compra e inventario; sin precio ni canales de
// venta. Las globales (insumos, dataInit) y los ayudantes (saveTab, statusTab,
// formSection...) viven en catalogo.js.

class Insumos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Insumos';
        this.tab = 'insumos';
        this.groups = [];
    }

    async render() {
        if ($('#filterBarInsumos').length) return;

        this.layout();
        await this.loadFilter();
        this.filterBar();
        this.ls();
    }

    // En Grupos pudieron dar de alta o de baja uno: el filtro se vuelve a leer.
    async reopen() {
        if (!$('#ins_active').length) return;

        const group  = $('#ins_group_id').val();
        const active = $('#ins_active').val();

        await this.loadFilter();
        this.filterBar();
        $('#ins_group_id').val(this.groups.some((g) => String(g.id) === group) ? group : '');
        $('#ins_active').val(active);
        this.ls();
    }

    // Clic en la foto: la vista previa en grande (foto-producto.js).
    layout() {
        $('#container-insumos').html(`
            <div id="filterBarInsumos" class="mb-[8px]"></div>
            <div id="containerInsumos"></div>
        `);

        lucideOnDraw('container-insumos');

        $('#container-insumos')
            .off('click.preview')
            .on('click.preview', '#containerInsumos img.cp-foto', (e) => photoPreview(this, e.currentTarget));
    }

    async loadFilter() {
        const response = await useFetch({ url: this._link, data: { opc: 'init' } });

        if (response && response.status == 200) this.groups = response.groups || [];
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarInsumos',
            id: 'fbInsumos',
            prefijo: 'ins_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'group_id',
                    lbl: 'Grupo',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, ...this.groups],
                    onchange: 'insumos.ls()'
                },
                statusFilterField('insumos'),
                newButtonField('btnNuevoInsumo', 'Nuevo insumo', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Insumo, Grupo, Unidad, [Último costo], Área, Stock, Mín, Máx, Lotes, Estado.
    ls() {
        const costs = can('ver-costos');

        this.createTable({
            parent: 'containerInsumos',
            idFilterBar: 'filterBarInsumos',
            data: { opc: 'lsInsumos' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: costs
                ? tableAttr('tbInsumos', [3, 5, 6, 7, 8, 9, 10], [4])
                : tableAttr('tbInsumos', [3, 4, 5, 6, 7, 8, 9]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Ficha --

    // Opciones de la ficha o null si la petición falló (ya avisó). keep: el insumo al editar.
    async formOptions(keep = {}) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'formOptions', keep_group_id: keep.supply_group_id || 0, keep_supplier_id: keep.supplier_id || 0 }
        });

        if (!response || response.status != 200) {
            notify(response);
            return null;
        }

        return {
            units: response.units || [],
            groups: response.groups || [],
            suppliers: response.suppliers || [],
            areas: response.areas || [],
            costs: !!response.costs
        };
    }

    // Identificación, compra e inventario en tercios, como la ficha del Catálogo de venta.
    jsonForm(options, row = {}) {
        const d = {
            name: '', supply_group_id: '', sku: '', description: '', unit_id: '', cost: '', supplier_id: '',
            warehouse_area_id: '', stock_min: '', stock_max: '', shelf_life_days: '', track_lots: 0,
            ...row
        };
        const third = 'w-full sm:w-1/3';
        const half  = 'w-full sm:w-1/2';

        return [
            formSection('secInsumoId', 'Identificación'),
            { id: 'name', lbl: 'Nombre', tipo: 'text', icon: 'wheat', required: true, maxlength: 255, ph: 'Harina de trigo', class: 'w-full', value: d.name },
            {
                id: 'supply_group_id', lbl: 'Grupo de insumos', tipo: 'select', empty: 'Sin grupo', class: half, data: options.groups, value: d.supply_group_id,
                help: options.groups.length ? '' : 'Los grupos se dan de alta en la pestaña «Grupos».'
            },
            { id: 'sku', lbl: 'SKU', tipo: 'text', icon: 'hash', maxlength: 80, ph: 'Opcional', class: half, value: d.sku },
            { id: 'photoField', tipo: 'html', class: 'w-full', html: photoFieldHtml() },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 1000, ph: 'Opcional', class: 'w-full', value: d.description },

            formSection('secInsumoCompra', 'Compra'),
            { id: 'unit_id', lbl: 'Unidad', tipo: 'select', required: true, empty: '— Elige la unidad —', class: third, data: options.units, value: d.unit_id },
            options.costs
                ? { id: 'cost', lbl: 'Último costo', tipo: 'number', icon: 'dollar-sign', min: 0, step: '0.01', ph: '0.00', class: third, value: d.cost }
                : null,
            {
                id: 'supplier_id', lbl: 'Proveedor habitual', tipo: 'select', empty: 'Sin proveedor', class: third, data: options.suppliers, value: d.supplier_id,
                help: options.suppliers.length ? '' : 'Se dan de alta en la pestaña «Proveedores».'
            },

            formSection('secInsumoInv', 'Inventario'),
            {
                id: 'warehouse_area_id', lbl: 'Dónde se guarda', tipo: 'select', empty: 'Sin área', class: third, data: options.areas, value: d.warehouse_area_id,
                help: options.areas.length ? '' : 'Las áreas se dan de alta en la pestaña «Áreas».'
            },
            { id: 'stock_min', lbl: 'Mínimo', tipo: 'number', icon: 'arrow-down-to-line', min: 0, step: '0.001', ph: '0', class: third, value: d.stock_min },
            { id: 'stock_max', lbl: 'Máximo', tipo: 'number', icon: 'arrow-up-to-line', min: 0, step: '0.001', ph: '0 = sin máximo', class: third, value: d.stock_max },
            { id: 'shelf_life_days', lbl: 'Vida útil (días)', tipo: 'number', icon: 'calendar-clock', min: 0, step: '1', ph: 'Opcional', class: third, value: d.shelf_life_days },
            { id: 'track_lots', lbl: 'Lote y caducidad', tipo: 'switch', class: `${third} cp-switch`, value: d.track_lots },
            formNote('insumoNota', 'Sin precio ni canales de venta: un insumo no sale en el POS. Lleva inventario siempre.')
        ].filter(Boolean);
    }

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalSupply',
            title: 'Nuevo insumo',
            subtitle: 'Algo que se compra y se cuenta, no se vende',
            lucideIcon: 'wheat',
            json: this.jsonForm(options),
            onSave: (values, close) => this.save('addInsumo', values, close)
        });

        this.mountPhoto();
    }

    // Foto a la izquierda y nombre, grupo y SKU a la derecha, como la ficha del Catálogo de venta.
    mountPhoto(image = '') {
        photoBeside('modalSupply', ['name', 'supply_group_id', 'sku']);
        this.photo = mountPhoto('modalSupply', image, 'icon-cube');
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getInsumo', id } });

        if (!response || response.status != 200) return notify(response);

        const options = await this.formOptions(response.data);

        if (!options) return;

        this.csModal({
            id: 'modalSupply',
            title: 'Editar insumo',
            subtitle: response.data.name,
            lucideIcon: 'wheat',
            json: this.jsonForm(options, response.data),
            onSave: (values, close) => this.save('editInsumo', { ...values, id }, close)
        });

        this.mountPhoto(response.data.image);
    }

    save(opc, values, close) {
        return saveTab(this, 'modalSupply', opc, { ...values, ...this.photo }, close, (v) => {
            const bad = (x) => String(x || '').trim() !== '' && !(Number(x) >= 0);
            const max = String(v.stock_max || '').trim();

            if (!String(v.name || '').trim()) return 'Escribe el nombre del insumo.';
            if (!v.unit_id) return 'Elige la unidad en que se cuenta (kilo, litro, pieza...).';
            if ('cost' in v && bad(v.cost)) return 'El costo debe ser un número mayor o igual a 0.';
            if (bad(v.stock_min) || bad(max)) return 'El mínimo y el máximo deben ser números mayores o iguales a 0.';
            if (max !== '' && Number(max) > 0 && Number(max) < Number(v.stock_min || 0)) return 'El máximo debe ser mayor que el mínimo (o 0 para no tener máximo).';

            return '';
        });
    }

    status(id, active) {
        statusTab(this, 'statusInsumo', id, active, 'el insumo', 'Deja de salir en Entradas, Salidas, Traspasos y Stock. Solo se puede con existencia en 0. No se borra.');
    }
}
