// -- Pestaña Motivos de salida --
// Por qué sale la mercancía. «Es merma» la cuenta como pérdida; «Pide foto» no
// deja guardar la salida sin evidencia. Los de «Sistema» (Venta...) solo
// cambian su nombre, descripción, ícono y color.

class MotivosSalida extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'MotivosSalida';
        this.tab = 'motivosSalida';
    }

    render() {
        if ($('#filterBarMotivosSalida').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-motivosSalida').html(`
            <div id="filterBarMotivosSalida" class="mb-[8px]"></div>
            <div id="containerMotivosSalida"></div>
        `);

        lucideOnDraw('container-motivosSalida');
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarMotivosSalida',
            id: 'fbMotivosSalida',
            prefijo: 'mot_',
            coffeesoft: true,
            data: [
                statusFilterField('motivosSalida'),
                newButtonField('btnNuevoMotivo', 'Nuevo motivo', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Motivo, Código, Es merma, Pide foto, Estado.
    ls() {
        this.createTable({
            parent: 'containerMotivosSalida',
            idFilterBar: 'filterBarMotivosSalida',
            data: { opc: 'lsMotivos' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbMotivosSalida', [2, 3, 4, 5]),
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

        if (system) fields.push(formNote('motivoNota', 'Lo usa el sistema: solo cambian el nombre, la descripción, el ícono y el color.'));

        fields.push(
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 120, ph: 'Caducado', class: 'w-full', value: row.name || '' },
            { id: 'icon', lbl: 'Ícono', tipo: 'icon', class: half, value: row.icon || (row.id ? '' : 'log-out') },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: half, value: row.color_hex || '#E11D48' },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Se ve al registrar una salida', class: 'w-full', value: row.description || '' }
        );

        if (!system) {
            fields.push(
                {
                    id: 'is_loss', lbl: 'Es merma', tipo: 'switch', class: 'w-full', value: Number(row.is_loss || 0),
                    help: 'Cuenta como pérdida en las tarjetas y los reportes.'
                },
                {
                    id: 'requires_evidence', lbl: 'Pide foto', tipo: 'switch', class: 'w-full', value: Number(row.requires_evidence || 0),
                    help: 'No deja guardar la salida sin una foto de evidencia.'
                }
            );
        }

        return fields;
    }

    add() {
        this.csModal({
            id: 'modalMotivoSalida',
            title: 'Nuevo motivo de salida',
            subtitle: 'Por qué sale la mercancía',
            lucideIcon: 'log-out',
            width: 'max-w-xl',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addMotivo', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getMotivo', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalMotivoSalida',
            title: 'Editar motivo de salida',
            subtitle: response.data.name,
            lucideIcon: 'log-out',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editMotivo', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalMotivoSalida', opc, values, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del motivo.'));
    }

    status(id, active) {
        statusTab(this, 'statusMotivo', id, active, 'el motivo');
    }
}
