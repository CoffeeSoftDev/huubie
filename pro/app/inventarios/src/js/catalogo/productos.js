// -- Pestaña Productos --
// Los productos del Catálogo de venta, con su foto, lleven inventario o no.
// Aquí se enciende «Inventario» y se edita su ficha de inventario: la misma de
// Stock › «Abrir ficha» (components/ficha-inventario.js). Nombre, precio y
// categoría se cambian en el Catálogo de venta.

class Productos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Productos';
        this.tab = 'productos';
        this.categorias = [];
        this.areas = [];
    }

    async render() {
        if ($('#filterBarProductos').length) return;

        this.layout();
        await this.loadFilter();
        this.filterBar();
        this.ls();
    }

    // En Áreas pudieron dar de alta una: los filtros se vuelven a leer.
    async reopen() {
        if (!$('#prd_inventory').length) return;

        const keep = ['prd_inventory', 'prd_category_id', 'prd_area_id'].map((id) => [id, $(`#${id}`).val()]);

        await this.loadFilter();
        this.filterBar();
        keep.forEach(([id, value]) => {
            if ($(`#${id} option`).filter((_, o) => o.value === value).length) $(`#${id}`).val(value);
        });
        this.ls();
    }

    // Clic en la foto: la vista previa en grande (foto-producto.js).
    layout() {
        $('#container-productos').html(`
            <div id="filterBarProductos" class="mb-[8px]"></div>
            <div id="containerProductos"></div>
        `);

        $('#container-productos')
            .off('click.preview')
            .on('click.preview', '#containerProductos img.cp-foto', (e) => photoPreview(this, e.currentTarget));
    }

    async loadFilter() {
        const response = await useFetch({ url: this._link, data: { opc: 'init' } });

        if (!response || response.status != 200) return;

        this.categorias = response.categorias || [];
        this.areas      = response.areas || [];
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarProductos',
            id: 'fbProductos',
            prefijo: 'prd_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'inventory',
                    lbl: 'Inventario',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, { id: '1', valor: 'Con inventario' }, { id: '0', valor: 'Sin inventario' }],
                    onchange: 'productos.ls()'
                },
                {
                    opc: 'select',
                    id: 'category_id',
                    lbl: 'Categoría',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todas' }, ...this.categorias],
                    onchange: 'productos.ls()'
                },
                {
                    opc: 'select',
                    id: 'area_id',
                    lbl: 'Dónde se guarda',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todas' }, ...this.areas],
                    onchange: 'productos.ls()'
                }
            ]
        });
    }

    // Columnas: Producto, Categoría, Inventario, Unidad, Área, [Último costo], Stock, Mín, Máx, Lotes.
    ls() {
        const costs = can('ver-costos');

        this.createTable({
            parent: 'containerProductos',
            idFilterBar: 'filterBarProductos',
            data: { opc: 'lsProductos' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: costs
                ? tableAttr('tbProductosInv', [3, 4, 5, 7, 8, 9, 10], [6])
                : tableAttr('tbProductosInv', [3, 4, 5, 6, 7, 8, 9]),
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Inventario --

    // El apagador de la columna (on = cómo está ahora). Encender va directo; apagar pregunta.
    inventory(id, on) {
        const turnOn = Number(on) !== 1;
        const send   = async () => {
            const response = await useFetch({ url: this._link, data: { opc: 'inventarioProducto', id, on: turnOn ? 1 : 0 } });

            afterSave(response, () => this.ls());
        };

        if (turnOn) return send();

        this.alertBox({
            type: 'cancel',
            title: '¿Quitarle el inventario?',
            detailHtml: 'Deja de salir en Entradas, Salidas, Traspasos y Stock, y ya no se descuenta al venderse. Su mínimo, máximo y área se guardan por si lo vuelves a encender.',
            okLabel: 'Quitar inventario',
            onOk: send
        });
    }

    // La ficha de inventario (la misma de Stock).
    edit(id) {
        this.invFicha({ url: this._link, id, onSaved: () => this.ls() });
    }
}
