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
                    class: 'col-12 col-lg-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'bundles.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewBundle',
                    class: 'col-12 col-lg-2',
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

    // -- Contenido: rejilla al estilo del POS de Soft --
    // Referencia: «Producto compuesto» de erp-pro/pro/app/pos (productos.js, pintarCompuesto).
    // Arriba lo que ya lleva; abajo la fila de captura: clave o nombre, cantidad y Enter.
    // No viaja en los values del modal: save() manda la lista aparte, como JSON.

    // Lo que se escribe o se elige en la captura: «clave · nombre», o solo el nombre si no tiene clave.
    pickLabel(component) {
        const sku = String(component.sku || '').trim();

        return sku ? `${sku} · ${component.valor}` : String(component.valor);
    }

    editorHtml() {
        const options = this.components
            .map((c) => `<option value="${esc(this.pickLabel(c))}" label="${esc(money(c.price))}"></option>`)
            .join('');

        return `
            <label for="bundlePick" class="block text-xs font-semibold text-gray-500 mb-1.5">
                Contenido del paquete <span class="text-red-500">*</span>
            </label>
            <div class="cp-rej">
                <table>
                    <thead>
                        <tr>
                            <th class="cp-rej-clave">Clave</th>
                            <th>Producto</th>
                            <th class="n cp-rej-cant">Cantidad</th>
                            <th class="n">Precio</th>
                            <th class="n">Importe</th>
                            <th class="cp-rej-boton"></th>
                        </tr>
                    </thead>
                    <tbody id="bundleRows"></tbody>
                    <tbody>
                        <tr class="nuevo">
                            <td class="ed" colspan="2">
                                <input id="bundlePick" type="text" list="bundleProducts" autocomplete="off" placeholder="Clave o descripción del producto">
                                <datalist id="bundleProducts">${options}</datalist>
                            </td>
                            <td class="ed"><input id="bundleQty" class="n" type="number" min="0.001" step="0.001" value="1" aria-label="Cantidad"></td>
                            <td class="n" id="bundlePickPrice">—</td>
                            <td class="n" id="bundlePickAmount">—</td>
                            <td class="cp-rej-boton"><button type="button" class="cp-rej-agregar" title="Agregar (Enter)">Agregar</button></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="n">Suma por separado</td>
                            <td class="n" id="bundleSeparate">${money(0)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p id="bundleSummary" class="cp-rej-nota"></p>
        `;
    }

    // El modal se recrea en cada apertura: estos handlers mueren con él.
    bindEditor() {
        const modal = $('#modalBundle');

        modal.on('click', '.cp-rej-agregar', () => this.addItem());

        // Enter en la fila de captura agrega, como en Soft; no envía el modal.
        modal.on('keydown', '#bundlePick, #bundleQty', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            this.addItem();
        });

        modal.on('input', '#bundlePick, #bundleQty', () => this.paintPick());

        // Al elegir de la lista se pasa a la cantidad (en Soft, al precio).
        modal.on('change', '#bundlePick', () => {
            if (this.findComponent(modal.find('#bundlePick').val())) modal.find('#bundleQty').trigger('focus').trigger('select');
        });

        modal.on('input', '.cp-rej-cantidad', (e) => {
            const input = $(e.currentTarget);
            const item  = this.draft[Number(input.data('index'))];

            if (!item) return;

            item.qty = Number(input.val()) || 0;
            input.closest('tr').find('.cp-rej-importe').text(money(item.price * item.qty));
            this.paintSummary();
        });

        modal.on('click', '.cp-rej-quitar', (e) => {
            this.draft.splice(Number($(e.currentTarget).data('index')), 1);
            this.paintList();
        });

        modal.on('input', '#price', () => this.paintSummary());

        this.paintList();
        this.paintPick();
    }

    // Igual que buscarProducto de Soft: exacto por «clave · nombre», clave o nombre;
    // si no, el único que contenga el texto. Varios parecidos = null (hay que afinar).
    findComponent(text) {
        const t = String(text || '').trim().toUpperCase();

        if (!t) return null;

        const exact = this.components.find((c) =>
            this.pickLabel(c).toUpperCase() === t
            || String(c.sku || '').trim().toUpperCase() === t
            || String(c.valor).toUpperCase() === t
        );

        if (exact) return exact;

        const similar = this.components.filter((c) => this.pickLabel(c).toUpperCase().includes(t));

        return similar.length === 1 ? similar[0] : null;
    }

    // Precio e importe de lo que se está capturando, antes de agregarlo.
    paintPick() {
        const modal     = $('#modalBundle');
        const component = this.findComponent(modal.find('#bundlePick').val());
        const qty       = Number(modal.find('#bundleQty').val()) || 0;

        modal.find('#bundlePickPrice').text(component ? money(component.price) : '—');
        modal.find('#bundlePickAmount').text(component && qty > 0 ? money(component.price * qty) : '—');
    }

    // El de la fila de captura. El mismo producto dos veces suma su cantidad en una sola línea.
    // Devuelve false si algo falta (ya avisó).
    addItem() {
        const modal = $('#modalBundle');
        const warn  = (text) => { warnBox(text); return false; };
        const text  = String(modal.find('#bundlePick').val() || '').trim();
        const qty   = Math.round(Number(modal.find('#bundleQty').val()) * 1000) / 1000;

        if (!text) return warn('Escribe la clave o el nombre del producto.');

        const component = this.findComponent(text);

        if (!component) return warn(`No encontré un solo producto con «${text}». Elígelo de la lista.`);
        if (!(qty > 0)) return warn('La cantidad debe ser mayor a 0.');

        const current = this.draft.find((item) => String(item.id) === String(component.id));

        if (current) {
            current.qty = Math.round((Number(current.qty) + qty) * 1000) / 1000;
        } else {
            this.draft.push({
                id: Number(component.id),
                sku: String(component.sku || ''),
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
        this.paintPick();
        setTimeout(() => modal.find('#bundlePick').trigger('focus'), 20);

        return true;
    }

    paintList() {
        const rows = $('#modalBundle #bundleRows');

        if (!this.draft.length) {
            rows.html('<tr><td colspan="6" class="cp-rej-vacia">Paquete vacío. Escribe abajo la clave o el nombre de un producto y pulsa Enter.</td></tr>');
            this.paintSummary();
            return;
        }

        rows.html(this.draft.map((item, index) => `
            <tr class="${item.inactive ? 'baja' : ''}">
                <td class="cp-rej-clave">${esc(item.sku) || '—'}</td>
                <td>${esc(item.name)}${item.inactive ? ' <span class="cp-chip bg-red-50 text-red-700">Inactivo</span>' : ''}</td>
                <td class="ed"><input type="number" min="0.001" step="0.001" value="${esc(item.qty)}" data-index="${index}"
                    aria-label="Cantidad de ${esc(item.name)}" class="cp-rej-cantidad n"></td>
                <td class="n">${money(item.price)}</td>
                <td class="n cp-rej-importe">${money(item.price * item.qty)}</td>
                <td class="cp-rej-boton"><button type="button" class="cp-rej-quitar" data-index="${index}" title="Quitar" aria-label="Quitar ${esc(item.name)}">&times;</button></td>
            </tr>
        `).join(''));

        this.paintSummary();
    }

    // La suma va al pie de la rejilla; abajo, el costo y cuánto ahorra el cliente con el paquete.
    paintSummary() {
        const modal    = $('#modalBundle');
        const summary  = modal.find('#bundleSummary');
        const separate = this.draft.reduce((sum, item) => sum + item.price * item.qty, 0);
        const cost     = this.draft.reduce((sum, item) => sum + item.cost * item.qty, 0);
        const price    = String(modal.find('#price').val() || '').trim();

        modal.find('#bundleSeparate').text(money(separate));

        if (!this.draft.length) {
            summary.html('');
            return;
        }

        const parts = [`Costo ${money(cost)}`];

        if (price !== '' && Number(price) >= 0) {
            const diff = separate - Number(price);

            if (diff > 0.005)       parts.push(`<span class="cp-rej-ahorro">El cliente ahorra ${money(diff)}</span>`);
            else if (diff < -0.005) parts.push(`<span class="cp-rej-caro">Cuesta ${money(-diff)} más que por separado</span>`);
            else                    parts.push('Mismo precio que por separado');
        }

        summary.html(parts.join(' · '));
    }

    // -- Altas y cambios --

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        if (!options.components.length) {
            return warnBox('Primero crea productos activos en la pestaña Productos: un paquete se arma con ellos.', 'message');
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
            sku: String(item.sku || ''),
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
        const warn     = (text) => warnBox(text);
        const price    = String(values.price || '').trim();
        const inactive = this.draft.filter((item) => item.inactive).map((item) => item.name);

        if (!String(values.name || '').trim()) return warn('Escribe el nombre del paquete.');
        if (price === '' || !(Number(price) >= 0)) return warn('Escribe el precio del paquete: un número mayor o igual a 0.');

        // Como en Soft: lo que quedó escrito en la captura se agrega antes de guardar.
        if (String($('#modalBundle #bundlePick').val() || '').trim() && !this.addItem()) return;
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
        confirmSend(this, {
            title: active ? '¿Activar el paquete?' : '¿Desactivar el paquete?',
            text: active ? 'Volverá a venderse.' : 'Dejará de venderse. No se borra.',
            danger: !active,
            data: { opc: 'statusBundle', id, active },
            done: (response) => afterSave(response, () => this.ls())
        });
    }
}
