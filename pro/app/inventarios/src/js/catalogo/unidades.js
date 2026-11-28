// -- Pestaña Unidades --
// En qué se cuenta cada producto e insumo (las usan las dos fichas). Con
// decimales se captura 2.5; sin ellos, piezas enteras.

class Unidades extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Unidades';
        this.tab = 'unidades';
    }

    render() {
        if ($('#filterBarUnidades').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-unidades').html(`
            <div id="filterBarUnidades" class="mb-[8px]"></div>
            <div id="containerUnidades"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarUnidades',
            id: 'fbUnidades',
            prefijo: 'uni_',
            coffeesoft: true,
            data: [
                statusFilterField('unidades'),
                newButtonField('btnNuevaUnidad', 'Nueva unidad', () => this.add())
            ].filter(Boolean)
        });
    }

    // Columnas: Código, Unidad, Decimales, Productos, Estado.
    ls() {
        this.createTable({
            parent: 'containerUnidades',
            idFilterBar: 'filterBarUnidades',
            data: { opc: 'lsUnidades' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: tableAttr('tbUnidades', [3, 4, 5]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    jsonForm(row = {}) {
        return [
            { id: 'code', lbl: 'Código', tipo: 'text', required: true, maxlength: 20, ph: 'KG', class: 'w-full sm:w-1/3', value: row.code || '' },
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 80, ph: 'Kilogramo', class: 'w-full sm:w-2/3', value: row.name || '' },
            {
                id: 'allows_decimals', lbl: 'Acepta decimales', tipo: 'switch', class: 'w-full', value: Number(row.allows_decimals || 0),
                help: 'Kilo o litro: se captura 2.5. Pieza o caja: solo enteros.'
            }
        ];
    }

    add() {
        this.csModal({
            id: 'modalUnidad',
            title: 'Nueva unidad',
            subtitle: 'En qué se cuenta un producto o un insumo',
            lucideIcon: 'ruler',
            width: 'max-w-xl',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addUnidad', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getUnidad', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalUnidad',
            title: 'Editar unidad',
            subtitle: response.data.name,
            lucideIcon: 'ruler',
            width: 'max-w-xl',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editUnidad', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        return saveTab(this, 'modalUnidad', opc, values, close, (v) => {
            if (!String(v.code || '').trim()) return 'Escribe el código de la unidad.';
            if (!String(v.name || '').trim()) return 'Escribe el nombre de la unidad.';

            return '';
        });
    }

    status(id, active) {
        statusTab(this, 'statusUnidad', id, active, 'la unidad', 'Deja de ofrecerse en las fichas. Una unidad en uso no se da de baja. No se borra.');
    }
}
