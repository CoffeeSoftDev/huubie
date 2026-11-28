// -- Pestaña Departamentos --
// «Área que pide» en la requisición: Pastelería, Panadería, Mostrador... Con su
// ícono y color. Nada se borra: se da de baja y se reactiva desde «Inactivos».

class Departamentos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Departamentos';
        this.tab = 'departamentos';
    }

    render() {
        if ($('#filterBarDepartamentos').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-departamentos').html(`
            <div id="filterBarDepartamentos" class="mb-[8px]"></div>
            <div id="containerDepartamentos"></div>
        `);

        lucideOnDraw('container-departamentos');
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarDepartamentos',
            id: 'fbDepartamentos',
            prefijo: 'dep_',
            coffeesoft: true,
            data: [
                statusFilterField('departamentos'),
                newButtonField('btnNuevoDepartamento', 'Nuevo departamento', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Departamento, Orden, Estado.
    ls() {
        this.createTable({
            parent: 'containerDepartamentos',
            idFilterBar: 'filterBarDepartamentos',
            data: { opc: 'lsDepartamentos' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbDepartamentos', [2, 3]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    jsonForm(row = {}) {
        const half = 'w-full sm:w-1/2';

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 80, ph: 'Pastelería', class: 'w-full', value: row.name || '' },
            { id: 'icon', lbl: 'Ícono', tipo: 'icon', class: half, value: row.icon || (row.id ? '' : 'users') },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: half, value: row.color_hex || '#64748B' }
        ];
    }

    add() {
        this.csModal({
            id: 'modalDepartamento',
            title: 'Nuevo departamento',
            subtitle: 'El área que pide en las requisiciones',
            lucideIcon: 'users',
            width: 'max-w-xl',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addDepartamento', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getDepartamento', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalDepartamento',
            title: 'Editar departamento',
            subtitle: response.data.name,
            lucideIcon: 'users',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editDepartamento', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalDepartamento', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del departamento.'));
    }

    status(id, active) {
        statusTab(this, 'statusDepartamento', id, active, 'el departamento', 'Deja de ofrecerse en las requisiciones. No se borra: lo reactivas desde «Inactivos».');
    }
}
