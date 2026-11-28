// -- Pestaña Grupos --
// Grupos de insumos (Harinas, Lácteos, Empaques): de la empresa y aparte de
// las categorías de venta, como los «Grupos de insumos» de Soft Restaurant.

class Grupos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Grupos';
        this.tab = 'grupos';
    }

    render() {
        if ($('#filterBarGrupos').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-grupos').html(`
            <div id="filterBarGrupos" class="mb-[8px]"></div>
            <div id="containerGrupos"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarGrupos',
            id: 'fbGrupos',
            prefijo: 'grp_',
            coffeesoft: true,
            data: [
                statusFilterField('grupos'),
                newButtonField('btnNuevoGrupo', 'Nuevo grupo', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Grupo, Descripción, Insumos, Estado.
    ls() {
        this.createTable({
            parent: 'containerGrupos',
            idFilterBar: 'filterBarGrupos',
            data: { opc: 'lsGrupos' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbGrupos', [3, 4]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    jsonForm(row = {}) {
        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', icon: 'layers', required: true, maxlength: 120, ph: 'Harinas, Lácteos, Empaques', class: 'w-full sm:w-2/3', value: row.name || '' },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: 'w-full sm:w-1/3', value: row.color_hex || '#64748B' },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Opcional', class: 'w-full', value: row.description || '' }
        ];
    }

    add() {
        this.csModal({
            id: 'modalGrupo',
            title: 'Nuevo grupo de insumos',
            subtitle: 'Junta los insumos parecidos para buscarlos y contarlos',
            lucideIcon: 'layers',
            width: 'max-w-xl',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addGrupo', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getGrupo', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalGrupo',
            title: 'Editar grupo de insumos',
            subtitle: response.data.name,
            lucideIcon: 'layers',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editGrupo', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalGrupo', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del grupo.'));
    }

    status(id, active) {
        statusTab(this, 'statusGrupo', id, active, 'el grupo', 'Deja de ofrecerse en la ficha del insumo. Sus insumos lo conservan. No se borra.');
    }
}
