// -- Pestaña Estados de requisición --
// Los usa el flujo de Requisiciones y Surtir: no se agregan ni se dan de baja y
// el nombre no cambia. Solo su ícono y su color (la insignia de la lista, el
// visor y la leyenda). Sin color = el del tema.

class EstadosRequisicion extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'EstadosRequisicion';
        this.tab = 'estadosReq';
    }

    render() {
        if ($('#filterBarEstadosReq').length) return;

        this.layout();
        this.ls();
    }

    layout() {
        $('#container-estadosReq').html(`
            <div id="filterBarEstadosReq"></div>
            <div id="containerEstadosReq"></div>
        `);

        lucideOnDraw('container-estadosReq');
    }

    // Columnas: Estado, Orden, Final, Código.
    ls() {
        this.createTable({
            parent: 'containerEstadosReq',
            idFilterBar: 'filterBarEstadosReq',
            data: { opc: 'lsEstadosReq' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbEstadosReq', [2, 3, 4]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    jsonForm(row = {}) {
        const half = 'w-full sm:w-1/2';

        return [
            formNote('estadoReqNota', `<b>${esc(row.name)}</b> (código <b class="font-mono">${esc(row.code)}</b>): lo usa el flujo de la requisición; solo cambian su ícono y su color.`),
            { id: 'icon', lbl: 'Ícono', tipo: 'icon', class: half, value: row.icon || 'circle' },
            { id: 'color_hex', lbl: 'Color', tipo: 'color', class: half, value: row.color_hex || '#C05A40' }
        ];
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getEstadoReq', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalEstadoReq',
            title: 'Editar estado de requisición',
            subtitle: response.data.name,
            lucideIcon: 'clipboard-list',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => saveTab(this, 'modalEstadoReq', 'editEstadoReq', { ...values, id }, close)
        });
    }
}
