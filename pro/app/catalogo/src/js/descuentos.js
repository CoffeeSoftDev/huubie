// -- Pestaña Descuentos --
// Las globales (discounts, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class Discounts extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Discounts';
        this.tab = 'discounts';
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarDiscounts').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-discounts').html(`
            <div id="filterBarDiscounts" class="mb-[8px]"></div>
            <div id="containerDiscounts"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarDiscounts',
            id: 'fbDiscounts',
            prefijo: 'dis_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'discounts.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewDiscount',
                    class: 'col-12 col-md-3 col-lg-2',
                    text: 'Nuevo descuento',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: 'containerDiscounts',
            idFilterBar: 'filterBarDiscounts',
            data: { opc: 'lsDiscounts' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbDiscounts',
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
        const data = { name: '', code: '', max_percent: 0, requires_authorization: 0, ...row };

        return [
            { id: 'name', lbl: 'Motivo', tipo: 'text', required: true, maxlength: 80, class: 'w-full', value: data.name },
            { id: 'code', lbl: 'Clave', tipo: 'text', maxlength: 20, help: 'Clave corta opcional, por ejemplo PROMO', value: data.code },
            { id: 'max_percent', lbl: 'Tope (%)', tipo: 'number', min: 0, max: 100, step: '0.01', help: 'Lo más que se puede descontar con este motivo', value: data.max_percent },
            { id: 'requires_authorization', lbl: 'Pide autorización', tipo: 'switch', class: 'w-full', value: data.requires_authorization }
        ];
    }

    add() {
        this.csModal({
            id: 'modalDiscount',
            title: 'Nuevo descuento',
            subtitle: 'Motivo de descuento para todas las sucursales de la empresa',
            lucideIcon: 'badge-percent',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addDiscount', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getDiscount', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalDiscount',
            title: 'Editar descuento',
            subtitle: 'Cambia el motivo, su tope o si pide autorización',
            lucideIcon: 'badge-percent',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editDiscount', { ...values, id }, close)
        });
    }

    // Devuelve el primer problema del formulario, o '' si está bien.
    validate(values) {
        if (!String(values.name || '').trim()) return 'Escribe el motivo del descuento.';

        const percent = Number(String(values.max_percent || '').trim() || 0);
        if (!(percent >= 0 && percent <= 100)) return 'El tope debe ser un número de 0 a 100.';

        return '';
    }

    save(opc, values, close) {
        const problem = this.validate(values);

        if (problem) {
            alert({ icon: 'warning', text: problem, btn1: true });
            return;
        }

        return saveFrom('modalDiscount', async () => {
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
                title: active ? '¿Activar el descuento?' : '¿Desactivar el descuento?',
                text: active ? 'Volverá a ofrecerse en caja.' : 'Dejará de ofrecerse en caja. Los descuentos ya aplicados no cambian.'
            },
            data: { opc: 'statusDiscount', id, active },
            methods: {
                send: (response) => afterSave(response, () => this.ls())
            }
        });
    }
}
