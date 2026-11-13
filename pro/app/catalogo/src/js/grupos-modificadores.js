// -- Pestaña Grupos de modificadores --
// Las globales (modifierGroups, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class ModifierGroups extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'ModifierGroups';
        this.tab = 'modifierGroups';
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarModifierGroups').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-modifierGroups').html(`
            <div id="filterBarModifierGroups" class="mb-[8px]"></div>
            <div id="containerModifierGroups"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarModifierGroups',
            id: 'fbModifierGroups',
            prefijo: 'mg_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'modifierGroups.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewModifierGroup',
                    class: 'col-12 col-md-3 col-lg-2',
                    text: 'Nuevo grupo',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: 'containerModifierGroups',
            idFilterBar: 'filterBarModifierGroups',
            data: { opc: 'lsModifierGroups' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbModifierGroups',
                theme: 'light',
                striped: true,
                center: [2, 3, 4, 5]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    jsonForm(row = {}) {
        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 100, class: 'w-full', value: row.name || '' },
            { id: 'is_extra', lbl: 'Se cobra aparte', tipo: 'switch', class: 'w-full', value: row.is_extra || 0 }
        ];
    }

    add() {
        this.csModal({
            id: 'modalModifierGroup',
            title: 'Nuevo grupo',
            subtitle: 'Agrupa opciones como betún, relleno o decoración',
            lucideIcon: 'layers',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addModifierGroup', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getModifierGroup', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalModifierGroup',
            title: 'Editar grupo',
            subtitle: 'Cambia el nombre o cómo se cobra',
            lucideIcon: 'layers',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editModifierGroup', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        if (!String(values.name || '').trim()) {
            alert({ icon: 'warning', text: 'Escribe el nombre del grupo.', btn1: true });
            return;
        }

        return saveFrom('modalModifierGroup', async () => {
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
                title: active ? '¿Activar el grupo?' : '¿Desactivar el grupo?',
                text: active ? 'Sus modificadores volverán a ofrecerse.' : 'Sus modificadores dejarán de ofrecerse. No se borran.'
            },
            data: { opc: 'statusModifierGroup', id, active },
            methods: {
                send: (response) => afterSave(response, () => this.ls())
            }
        });
    }
}
