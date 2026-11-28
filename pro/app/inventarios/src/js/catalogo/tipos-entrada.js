// -- Pestaña Tipos de entrada --
// De dónde llega la mercancía. Los de «Sistema» los usa el flujo: solo cambian
// su nombre, descripción, ícono y color.

class TiposEntrada extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'TiposEntrada';
        this.tab = 'tiposEntrada';
    }

    render() {
        if ($('#filterBarTiposEntrada').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-tiposEntrada').html(`
            <div id="filterBarTiposEntrada" class="mb-[8px]"></div>
            <div id="containerTiposEntrada"></div>
        `);

        lucideOnDraw('container-tiposEntrada');
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarTiposEntrada',
            id: 'fbTiposEntrada',
            prefijo: 'tip_',
            coffeesoft: true,
            data: [
                statusFilterField('tiposEntrada'),
                newButtonField('btnNuevoTipo', 'Nuevo tipo', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Tipo, Código, Pide proveedor, Nace pendiente, Actualiza costo, Estado.
    ls() {
        this.createTable({
            parent: 'containerTiposEntrada',
            idFilterBar: 'filterBarTiposEntrada',
            data: { opc: 'lsTipos' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbTiposEntrada', [2, 3, 4, 5, 6]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // Uno del sistema solo cambia nombre, ícono, color y descripción.
    jsonForm(row = {}) {
        const half   = 'w-full sm:w-1/2';
        const system = Number(row.is_system) === 1;
        const fields = [];

        if (system) fields.push(formNote('tipoNota', 'Lo usa el sistema: solo cambian el nombre, la descripción, el ícono y el color.'));

        fields.push(
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 120, ph: 'Compra a proveedor', class: 'w-full', value: row.name || '' },
            { id: 'icon', lbl: 'Ícono', tipo: 'icon', class: half, value: row.icon || (row.id ? '' : 'log-in') },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: half, value: row.color_hex || '#4B5563' },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Se ve al registrar una entrada', class: 'w-full', value: row.description || '' }
        );

        if (!system) {
            fields.push(
                { id: 'requires_supplier', lbl: 'Pide proveedor', tipo: 'switch', class: 'w-full', value: Number(row.requires_supplier || 0) },
                {
                    id: 'starts_pending', lbl: 'Nace pendiente', tipo: 'switch', class: 'w-full', value: Number(row.starts_pending || 0),
                    help: 'No suma al guardar: se confirma después con la cantidad real, como Producción.'
                },
                {
                    id: 'updates_cost', lbl: 'Actualiza el último costo', tipo: 'switch', class: 'w-full', value: Number(row.updates_cost || 0),
                    help: 'El costo capturado pasa a la ficha del producto o del insumo.'
                }
            );
        }

        return fields;
    }

    add() {
        this.csModal({
            id: 'modalTipoEntrada',
            title: 'Nuevo tipo de entrada',
            subtitle: 'De dónde llega la mercancía',
            lucideIcon: 'log-in',
            width: 'max-w-xl',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addTipo', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getTipo', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalTipoEntrada',
            title: 'Editar tipo de entrada',
            subtitle: response.data.name,
            lucideIcon: 'log-in',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editTipo', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalTipoEntrada', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del tipo de entrada.'));
    }

    status(id, active) {
        statusTab(this, 'statusTipo', id, active, 'el tipo de entrada');
    }
}
