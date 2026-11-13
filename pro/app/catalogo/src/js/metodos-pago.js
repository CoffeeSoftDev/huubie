// -- Pestaña Métodos de pago --
// Las globales (paymentMethods, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class PaymentMethods extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'PaymentMethods';
        this.tab = 'paymentMethods';
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarPaymentMethods').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-paymentMethods').html(`
            <div id="filterBarPaymentMethods" class="mb-[8px]"></div>
            <div id="containerPaymentMethods"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarPaymentMethods',
            id: 'fbPaymentMethods',
            prefijo: 'pay_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'paymentMethods.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewPaymentMethod',
                    class: 'col-12 col-md-3 col-lg-2',
                    text: 'Nuevo método',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: 'containerPaymentMethods',
            idFilterBar: 'filterBarPaymentMethods',
            data: { opc: 'lsPaymentMethods' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbPaymentMethods',
                theme: 'light',
                striped: true,
                center: [3, 4, 5, 6, 7, 8, 9]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    jsonForm(row, kinds) {
        const data = { name: '', code: '', kind: '', commission: 0, sort: 0, is_cash: 0, is_visible: 1, earns_points: 0, ...row };

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 50, class: 'w-full', value: data.name },
            { id: 'code', lbl: 'Clave', tipo: 'text', maxlength: 20, help: 'Clave corta opcional, por ejemplo VALES', value: data.code },
            { id: 'kind', lbl: 'Tipo', tipo: 'select', data: kinds, value: data.kind },
            { id: 'commission', lbl: 'Comisión (%)', tipo: 'number', min: 0, max: 100, step: '0.01', value: data.commission },
            { id: 'sort', lbl: 'Orden', tipo: 'number', min: 0, step: 1, value: data.sort },
            { id: 'is_cash', lbl: 'Es efectivo', tipo: 'switch', class: 'w-full sm:w-1/3', value: data.is_cash },
            { id: 'is_visible', lbl: 'Visible en caja', tipo: 'switch', class: 'w-full sm:w-1/3', value: data.is_visible },
            { id: 'earns_points', lbl: 'Acumula puntos', tipo: 'switch', class: 'w-full sm:w-1/3', value: data.earns_points }
        ];
    }

    async add() {
        const options = await useFetch({ url: this._link, data: { opc: 'formOptions' } });

        if (!options || options.status != 200) return notify(options);

        this.csModal({
            id: 'modalPaymentMethod',
            title: 'Nuevo método de pago',
            subtitle: 'Forma de cobro para todas las sucursales de la empresa',
            lucideIcon: 'credit-card',
            json: this.jsonForm({}, options.kinds),
            onSave: (values, close) => this.save('addPaymentMethod', values, close)
        });
    }

    async edit(id) {
        const [response, options] = await Promise.all([
            useFetch({ url: this._link, data: { opc: 'getPaymentMethod', id } }),
            useFetch({ url: this._link, data: { opc: 'formOptions', keep_id: id } })
        ]);

        if (!response || response.status != 200) return notify(response);
        if (!options || options.status != 200) return notify(options);

        this.csModal({
            id: 'modalPaymentMethod',
            title: 'Editar método de pago',
            subtitle: 'Cambia los datos de esta forma de cobro',
            lucideIcon: 'credit-card',
            json: this.jsonForm(response.data, options.kinds),
            onSave: (values, close) => this.save('editPaymentMethod', { ...values, id }, close)
        });
    }

    // Devuelve el primer problema del formulario, o '' si está bien.
    validate(values) {
        if (!String(values.name || '').trim()) return 'Escribe el nombre del método de pago.';

        const commission = Number(values.commission || 0);
        if (!(commission >= 0 && commission <= 100)) return 'La comisión debe ser un número de 0 a 100.';

        const sort = Number(values.sort || 0);
        if (!Number.isInteger(sort) || sort < 0) return 'El orden debe ser un número entero de 0 en adelante.';

        return '';
    }

    save(opc, values, close) {
        const problem = this.validate(values);

        if (problem) {
            alert({ icon: 'warning', text: problem, btn1: true });
            return;
        }

        return saveFrom('modalPaymentMethod', async () => {
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
                title: active ? '¿Activar el método de pago?' : '¿Desactivar el método de pago?',
                text: active ? 'Volverá a estar disponible para cobrar.' : 'Dejará de estar disponible para cobrar. Los cobros ya registrados no cambian.'
            },
            data: { opc: 'statusPaymentMethod', id, active },
            methods: {
                send: (response) => afterSave(response, () => this.ls())
            }
        });
    }
}
