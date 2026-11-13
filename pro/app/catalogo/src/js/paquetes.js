// -- Pestaña Paquetes --
// Las globales (bundles, dataInit) y los ayudantes (notify, afterSave, saveFrom, esc, money) viven en catalogo.js.

class Bundles extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Bundles';
        this.tab = 'bundles';
        this.components = []; // lo que se puede meter al paquete: productos y servicios activos
        this.draft = [];      // lo que lleva el paquete abierto en el modal
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarBundles').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-bundles').html(`
            <div id="filterBarBundles" class="mb-[8px]"></div>
            <div id="containerBundles"></div>
        `);
    }

    // -- Filtro --

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarBundles',
            id: 'fbBundles',
            prefijo: 'bun_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'bundles.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewBundle',
                    class: 'col-12 col-md-3 col-lg-2',
                    text: 'Nuevo paquete',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: 'containerBundles',
            idFilterBar: 'filterBarBundles',
            data: { opc: 'lsBundles' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbBundles',
                theme: 'light',
                striped: true,
                right: [3, 4],
                center: [5]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    // Categorías y productos para el modal, o null si la petición falló (ya avisó). keepId: la categoría actual.
    async formOptions(keepId = 0) {
        const response = await useFetch({ url: this._link, data: { opc: 'formOptions', keep_id: keepId } });

        if (!response || response.status != 200) {
            notify(response);
            return null;
        }

        return { categories: response.categories || [], components: response.components || [] };
    }

    jsonForm(categories, row = {}) {
        const data = { name: '', category_id: '', price: '', description: '', sell_pos: 1, in_catalog: 0, ...row };

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 255, class: 'w-full', value: data.name },
            { id: 'category_id', lbl: 'Categoría', tipo: 'select', empty: 'Sin categoría', data: categories, value: data.category_id },
            { id: 'price', lbl: 'Precio del paquete', tipo: 'number', required: true, min: 0, step: '0.01', ph: '0.00', value: data.price },
            { id: 'bundleEditor', tipo: 'html', class: 'w-full', html: this.editorHtml() },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 1000, class: 'w-full', value: data.description },
            { id: 'sell_pos', lbl: 'Se vende en el POS', tipo: 'switch', value: data.sell_pos },
            { id: 'in_catalog', lbl: 'Sale en el catálogo en línea', tipo: 'switch', value: data.in_catalog }
        ];
    }

    // -- Editor del contenido --
    // No viaja en los values del modal: save() manda la lista aparte, como JSON.

    editorHtml() {
        const input = 'text-sm text-gray-800 bg-[#fff] border-[1px] border-gray-300 rounded-lg px-[12px] py-2 '
                    + 'focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';

        const options = this.components
            .map((c) => `<option value="${esc(c.id)}">${esc(c.valor)} · ${esc(money(c.price))}</option>`)
            .join('');

        return `
            <label for="bundlePick" class="block text-xs font-semibold text-gray-500 mb-1.5">
                Contenido del paquete <span class="text-red-500">*</span>
            </label>
            <div class="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select id="bundlePick" class="${input} w-full sm:flex-1 min-w-0">
                    <option value="">— Elige un producto —</option>${options}
                </select>
                <input id="bundleQty" type="number" min="0.001" step="0.001" value="1" aria-label="Cantidad" class="${input} w-24 shrink-0">
                <button type="button" class="cp-bundle-add shrink-0 px-[12px] py-2 text-sm font-semibold text-white rounded-lg bg-main hover:bg-main-hover">Agregar</button>
            </div>
            <div id="bundleList" class="mt-2 border-[1px] border-gray-200 rounded-lg"></div>
            <p id="bundleSummary" class="text-xs text-gray-500 mt-1.5 mb-0"></p>
        `;
    }

    // El modal se recrea en cada apertura: estos handlers mueren con él.
    bindEditor() {
        const modal = $('#modalBundle');

        modal.on('click', '.cp-bundle-add', () => this.addItem());

        modal.on('keydown', '#bundleQty', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            this.addItem();
        });

        modal.on('input', '.cp-bundle-qty', (e) => {
            const input = $(e.currentTarget);
            const item  = this.draft[Number(input.data('index'))];

            if (!item) return;

            item.qty = Number(input.val()) || 0;
            input.closest('.cp-bundle-row').find('.cp-bundle-money').text(money(item.price * item.qty));
            this.paintSummary();
        });

        modal.on('click', '.cp-bundle-remove', (e) => {
            this.draft.splice(Number($(e.currentTarget).data('index')), 1);
            this.paintList();
        });

        modal.on('input', '#price', () => this.paintSummary());

        this.paintList();
    }

    // El mismo producto dos veces suma su cantidad en una sola línea.
    addItem() {
        const modal = $('#modalBundle');
        const warn  = (text) => alert({ icon: 'warning', text, btn1: true });
        const id    = String(modal.find('#bundlePick').val() || '');
        const qty   = Math.round(Number(modal.find('#bundleQty').val()) * 1000) / 1000;

        if (!id) return warn('Elige un producto de la lista.');
        if (!(qty > 0)) return warn('La cantidad debe ser mayor a 0.');

        const component = this.components.find((c) => String(c.id) === id);

        if (!component) return;

        const current = this.draft.find((item) => String(item.id) === id);

        if (current) {
            current.qty = Math.round((Number(current.qty) + qty) * 1000) / 1000;
        } else {
            this.draft.push({
                id: Number(component.id),
                name: component.valor,
                qty,
                price: Number(component.price),
                cost: Number(component.cost),
                inactive: false
            });
        }

        modal.find('#bundlePick').val('');
        modal.find('#bundleQty').val(1);
        this.paintList();
    }

    paintList() {
        const list = $('#modalBundle #bundleList');

        if (!this.draft.length) {
            list.html('<p class="text-sm text-gray-400 text-center py-[12px] mb-0">Todavía no agregas productos.</p>');
            this.paintSummary();
            return;
        }

        list.html(this.draft.map((item, index) => `
            <div class="cp-bundle-row flex items-center gap-2 px-[12px] py-2 border-b-[1px] border-gray-200 last:border-b-0">
                <div class="flex-1 min-w-0 text-sm text-gray-800 break-words">
                    ${esc(item.name)}${item.inactive ? ' <span class="cp-chip bg-red-50 text-red-700">Inactivo</span>' : ''}
                </div>
                <input type="number" min="0.001" step="0.001" value="${esc(item.qty)}" data-index="${index}"
                    aria-label="Cantidad de ${esc(item.name)}"
                    class="cp-bundle-qty w-20 shrink-0 text-sm text-gray-800 bg-[#fff] border-[1px] border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:border-blue-600">
                <div class="cp-bundle-money w-24 shrink-0 text-right text-sm text-gray-700">${money(item.price * item.qty)}</div>
                <button type="button" data-index="${index}" aria-label="Quitar"
                    class="cp-bundle-remove w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-md text-lg leading-none text-gray-400 hover:text-red-600 hover:bg-red-50">&times;</button>
            </div>
        `).join(''));

        this.paintSummary();
    }

    // Compara el precio del paquete contra comprar lo mismo por separado.
    paintSummary() {
        const summary = $('#modalBundle #bundleSummary');

        if (!this.draft.length) {
            summary.text('');
            return;
        }

        const separate = this.draft.reduce((sum, item) => sum + item.price * item.qty, 0);
        const cost     = this.draft.reduce((sum, item) => sum + item.cost * item.qty, 0);
        const price    = String($('#modalBundle #price').val() || '').trim();
        const parts    = [`Por separado ${money(separate)}`, `Costo ${money(cost)}`];

        if (price !== '' && Number(price) >= 0) {
            const diff = separate - Number(price);

            if (diff > 0.005)       parts.push(`El cliente ahorra ${money(diff)}`);
            else if (diff < -0.005) parts.push(`Cuesta ${money(-diff)} más que por separado`);
            else                    parts.push('Mismo precio que por separado');
        }

        summary.text(parts.join(' · '));
    }

    // -- Altas y cambios --

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        if (!options.components.length) {
            return alert({ icon: 'info', text: 'Primero crea productos activos en la pestaña Productos: un paquete se arma con ellos.', btn1: true });
        }

        // Antes de jsonForm(): editorHtml() pinta las opciones con this.components.
        this.components = options.components;
        this.draft = [];

        this.csModal({
            id: 'modalBundle',
            title: 'Nuevo paquete',
            subtitle: 'Varios productos que se venden juntos a un solo precio',
            lucideIcon: 'gift',
            width: 'max-w-3xl',
            json: this.jsonForm(options.categories),
            onSave: (values, close) => this.save('addBundle', values, close)
        });

        this.bindEditor();
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getBundle', id } });

        if (!response || response.status != 200) return notify(response);

        const options = await this.formOptions(response.data.category_id || 0);

        if (!options) return;

        this.components = options.components;
        this.draft = (response.items || []).map((item) => ({
            id: Number(item.id),
            name: item.name,
            qty: Number(item.qty),
            price: Number(item.price),
            cost: Number(item.cost),
            inactive: Number(item.active) === 0
        }));

        this.csModal({
            id: 'modalBundle',
            title: 'Editar paquete',
            subtitle: 'Cambia lo que lleva, su precio o dónde se vende',
            lucideIcon: 'gift',
            width: 'max-w-3xl',
            json: this.jsonForm(options.categories, response.data),
            onSave: (values, close) => this.save('editBundle', { ...values, id }, close)
        });

        this.bindEditor();
    }

    save(opc, values, close) {
        const warn     = (text) => alert({ icon: 'warning', text, btn1: true });
        const price    = String(values.price || '').trim();
        const inactive = this.draft.filter((item) => item.inactive).map((item) => item.name);

        if (!String(values.name || '').trim()) return warn('Escribe el nombre del paquete.');
        if (price === '' || !(Number(price) >= 0)) return warn('Escribe el precio del paquete: un número mayor o igual a 0.');
        if (!this.draft.length) return warn('Agrega al menos un producto al paquete.');
        if (this.draft.some((item) => !(Number(item.qty) > 0))) return warn('Cada producto del paquete necesita una cantidad mayor a 0.');

        if (inactive.length) {
            return warn(`Lleva productos inactivos: ${inactive.join(', ')}. Quítalos del paquete o actívalos en la pestaña Productos.`);
        }

        const components = JSON.stringify(this.draft.map((item) => ({ id: item.id, qty: Number(item.qty) })));

        return saveFrom('modalBundle', async () => {
            const response = await useFetch({ url: this._link, data: { opc, ...values, components } });

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
                title: active ? '¿Activar el paquete?' : '¿Desactivar el paquete?',
                text: active ? 'Volverá a venderse.' : 'Dejará de venderse. No se borra.'
            },
            data: { opc: 'statusBundle', id, active },
            methods: {
                send: (response) => afterSave(response, () => this.ls())
            }
        });
    }
}
