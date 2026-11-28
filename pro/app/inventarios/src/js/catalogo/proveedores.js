// -- Pestaña Proveedores --
// Se eligen al capturar una entrada por compra y como proveedor habitual del
// insumo. Son de toda la empresa.

class Proveedores extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Proveedores';
        this.tab = 'proveedores';
    }

    render() {
        if ($('#filterBarProveedores').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-proveedores').html(`
            <div id="filterBarProveedores" class="mb-[8px]"></div>
            <div id="containerProveedores"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarProveedores',
            id: 'fbProveedores',
            prefijo: 'prv_',
            coffeesoft: true,
            data: [
                statusFilterField('proveedores'),
                newButtonField('btnNuevoProveedor', 'Nuevo proveedor', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Proveedor, Contacto, Teléfono, Correo, RFC, Estado.
    ls() {
        this.createTable({
            parent: 'containerProveedores',
            idFilterBar: 'filterBarProveedores',
            data: { opc: 'lsProveedores' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbProveedores', [3, 5, 6]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    jsonForm(row = {}) {
        const half = 'w-full sm:w-1/2';

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', icon: 'truck', required: true, maxlength: 160, ph: 'Harinas del Sureste', class: 'w-full', value: row.name || '' },
            { id: 'contact_name', lbl: 'Contacto', tipo: 'text', icon: 'user', maxlength: 120, class: half, value: row.contact_name || '' },
            { id: 'phone', lbl: 'Teléfono', tipo: 'text', icon: 'phone', maxlength: 10, ph: '10 dígitos', class: half, value: row.phone || '' },
            { id: 'email', lbl: 'Correo', tipo: 'text', icon: 'mail', maxlength: 120, class: half, value: row.email || '' },
            { id: 'rfc', lbl: 'RFC', tipo: 'text', maxlength: 13, ph: '12 o 13 caracteres', class: half, value: row.rfc || '' },
            { id: 'note', lbl: 'Nota', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Opcional', class: 'w-full', value: row.note || '' }
        ];
    }

    add() {
        this.csModal({
            id: 'modalProveedor',
            title: 'Nuevo proveedor',
            subtitle: 'A quién se le compra',
            lucideIcon: 'truck',
            width: 'max-w-xl',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addProveedor', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getProveedor', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalProveedor',
            title: 'Editar proveedor',
            subtitle: response.data.name,
            lucideIcon: 'truck',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editProveedor', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalProveedor', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del proveedor.'));
    }

    status(id, active) {
        statusTab(this, 'statusProveedor', id, active, 'el proveedor');
    }
}
