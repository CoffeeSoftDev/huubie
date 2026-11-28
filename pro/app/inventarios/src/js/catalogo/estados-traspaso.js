// -- Pestaña Estados --
// Los estados del traspaso los usa el flujo: no se agregan ni se dan de baja.
// Se cambia cómo se llaman (para quien envía y para quien recibe) y su color.
// Sin filtros: la barra vacía es la que createTable necesita para leer.

class EstadosTraspaso extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'EstadosTraspaso';
        this.tab = 'estados';
    }

    render() {
        if ($('#filterBarEstados').length) return;

        this.layout();
        this.ls();
    }

    layout() {
        $('#container-estados').html(`
            <div id="filterBarEstados"></div>
            <div id="containerEstados"></div>
        `);

        lucideOnDraw('container-estados');
    }

    // Columnas: Estado, Lo ve quien envía, Lo ve quien recibe, Código.
    ls() {
        this.createTable({
            parent: 'containerEstados',
            idFilterBar: 'filterBarEstados',
            data: { opc: 'lsEstados' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbEstados', [2, 3, 4]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    jsonForm(row = {}) {
        const half = 'w-full sm:w-1/2';

        return [
            formNote('estadoNota', `Código <b class="font-mono">${esc(row.code)}</b>: lo usa el flujo del traspaso y no cambia.`),
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 80, class: 'w-full', value: row.name || '' },
            { id: 'name_out', lbl: 'Lo ve quien envía', tipo: 'text', maxlength: 50, ph: row.name || '', class: half, value: row.name_out || '' },
            { id: 'name_in', lbl: 'Lo ve quien recibe', tipo: 'text', maxlength: 50, ph: row.name || '', class: half, value: row.name_in || '' },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: half, value: row.color_hex || '#4B5563' }
        ];
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getEstado', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalEstado',
            title: 'Editar estado del traspaso',
            subtitle: response.data.name,
            lucideIcon: 'arrow-left-right',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => saveTab(this, 'modalEstado', 'editEstado', { ...values, id }, close, (v) => (String(v.name || '').trim() ? '' : 'Escribe el nombre del estado.'))
        });
    }
}
