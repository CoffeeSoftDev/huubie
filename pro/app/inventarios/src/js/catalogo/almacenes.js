// -- Pestaña Almacenes --
// Cada sucursal tiene al menos uno. El Dueño o root ven los de todas y eligen
// el principal (Matriz: ahí se piden las requisiciones).

class Almacenes extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Almacenes';
        this.tab = 'almacenes';
    }

    render() {
        if ($('#filterBarAlmacenes').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-almacenes').html(`
            <div id="filterBarAlmacenes" class="mb-[8px]"></div>
            <div id="containerAlmacenes"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarAlmacenes',
            id: 'fbAlmacenes',
            prefijo: 'alm_',
            coffeesoft: true,
            data: [
                statusFilterField('almacenes'),
                newButtonField('btnNuevoAlmacen', 'Nuevo almacén', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Almacén, Sucursal, Por defecto, Principal, Mueve inventario, Existencia, Estado.
    ls() {
        this.createTable({
            parent: 'containerAlmacenes',
            idFilterBar: 'filterBarAlmacenes',
            data: { opc: 'lsAlmacenes' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbAlmacenes', [3, 4, 5, 6, 7]),
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

    // Solo el Dueño o root eligen la sucursal y el principal.
    jsonForm(options, row = {}) {
        const admin = !!options.is_admin;
        const half  = 'w-full sm:w-1/2';
        const val   = (key, fallback) => (row[key] === null || row[key] === undefined ? fallback : row[key]);

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', icon: 'warehouse', required: true, maxlength: 120, ph: 'Almacén Centro', class: admin ? half : 'w-full', value: val('name', '') },
            admin
                ? { id: 'branch_id', lbl: 'Sucursal', tipo: 'select', empty: false, class: half, data: options.sucursales || [], value: val('branch_id', options.branch_id) }
                : null,
            {
                id: 'is_default', lbl: 'Por defecto en la sucursal', tipo: 'switch', class: 'w-full', value: Number(val('is_default', 0)),
                help: 'Es el que se elige solo al capturar. Uno por sucursal.'
            },
            admin
                ? {
                    id: 'is_main', lbl: 'Almacén principal (Matriz)', tipo: 'switch', class: 'w-full', value: Number(val('is_main', 0)),
                    help: 'Ahí se piden las requisiciones. Uno por empresa: marcar este le quita la marca al otro.'
                }
                : null,
            {
                id: 'supply_moves_stock', lbl: 'Surtir mueve inventario', tipo: 'switch', class: 'w-full', value: Number(val('supply_moves_stock', 1)),
                help: 'Al surtir una requisición de otra sucursal, la existencia sale de este almacén.'
            }
        ].filter(Boolean);
    }

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalAlmacen',
            title: 'Nuevo almacén',
            subtitle: 'Donde se guarda la mercancía de una sucursal',
            lucideIcon: 'warehouse',
            width: 'max-w-xl',
            json: this.jsonForm(options),
            onSave: (values, close) => this.save('addAlmacen', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getAlmacen', id } });

        if (!response || response.status != 200) return notify(response);

        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalAlmacen',
            title: 'Editar almacén',
            subtitle: response.data.name,
            lucideIcon: 'warehouse',
            width: 'max-w-xl',
            json: this.jsonForm(options, response.data),
            onSave: (values, close) => this.save('editAlmacen', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalAlmacen', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del almacén.'));
    }

    status(id, active) {
        statusTab(this, 'statusAlmacen', id, active, 'el almacén', 'Deja de ofrecerse en las capturas. El principal, el único de la sucursal o uno con existencia no se da de baja. No se borra.');
    }
}
