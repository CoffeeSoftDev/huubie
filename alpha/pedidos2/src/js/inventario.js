let apiInv = 'ctrl/ctrl-inventario.php';
let inv;
let invUnits = [];
let invSuppliers = [];
let invProducts = [];
let invSupplies = [];
let invCounts = {};

$(async () => {
    const req = await useFetch({ url: apiInv, data: { opc: "init" } });
    invUnits     = req.units || [];
    invSuppliers = req.suppliers || [];
    invProducts  = req.products || [];
    invSupplies  = req.supplies || [];
    invCounts    = req.counts || {};

    inv = new InventarioApp(apiInv, 'root');
    inv.render();
});

class InventarioApp extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Inventario";
    }

    render() {
        this.layout();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'flex p-2',
            card: {
                filterBar: { class: 'w-full mb-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full h-full', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar' + this.PROJECT_NAME).html(`
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <button class="bg-[#1F2A37] text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-700 text-sm" onclick="window.location.href='../pedidos/index.php'">
                        <i class="icon-arrow-left"></i> Pedidos
                    </button>
                    <h2 class="text-xl font-bold text-white"><i class="icon-box"></i> Inventario</h2>
                </div>
                <div id="invAlerts"></div>
            </div>
            <div id="invCounts" class="flex gap-3 mb-3"></div>
        `);

        this.renderCounts();

        this.tabLayout({
            parent: 'container' + this.PROJECT_NAME,
            id: 'tabsInventario',
            theme: 'light',
            type: 'short',
            json: [
                { id: 'insumos', tab: 'Insumos', icon: 'icon-box', onClick: () => this.ls(), active: true },
                { id: 'proveedores', tab: 'Proveedores', icon: 'icon-users', onClick: () => this.lsProveedores() },
                { id: 'recetas', tab: 'Recetas', icon: 'icon-book', onClick: () => this.renderRecetasPanel() },
                { id: 'mermas', tab: 'Mermas / Ajustes', icon: 'icon-attention', onClick: () => this.renderMermasPanel() },
                { id: 'compras', tab: 'Ordenes de Compra', icon: 'icon-basket', onClick: () => this.renderComprasPanel() },
                { id: 'kardex', tab: 'Kardex', icon: 'icon-list', onClick: () => this.renderKardexPanel() }
            ]
        });

        this.setupFilterBars();
    }

    renderCounts() {
        const c = invCounts;
        $('#invCounts').html(`
            <div class="bg-[#1F2A37] rounded-lg p-3 flex-1 text-center">
                <p class="text-gray-400 text-xs">Total insumos</p>
                <p class="text-white text-xl font-bold">${c.total || 0}</p>
            </div>
            <div class="bg-[#1F2A37] rounded-lg p-3 flex-1 text-center ${parseInt(c.low_stock) > 0 ? 'border border-yellow-500' : ''}">
                <p class="text-yellow-400 text-xs">Stock bajo</p>
                <p class="text-yellow-300 text-xl font-bold">${c.low_stock || 0}</p>
            </div>
            <div class="bg-[#1F2A37] rounded-lg p-3 flex-1 text-center ${parseInt(c.out_of_stock) > 0 ? 'border border-red-500' : ''}">
                <p class="text-red-400 text-xs">Sin stock</p>
                <p class="text-red-300 text-xl font-bold">${c.out_of_stock || 0}</p>
            </div>
        `);
    }

    setupFilterBars() {
        const containerInsumos = $('#container-insumos');
        containerInsumos.html('<div id="filterbar-insumos" class="mb-2"></div><div id="tabla-insumos"></div>');

        this.createfilterBar({
            parent: 'filterbar-insumos',
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNuevoInsumo',
                    text: 'Nuevo Insumo',
                    icon: 'icon-plus',
                    className: 'btn-primary w-100',
                    onClick: () => this.addSupply()
                }
            ]
        });

        const containerProveedores = $('#container-proveedores');
        containerProveedores.html('<div id="filterbar-proveedores" class="mb-2"></div><div id="tabla-proveedores"></div>');

        this.createfilterBar({
            parent: 'filterbar-proveedores',
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNuevoProveedor',
                    text: 'Nuevo Proveedor',
                    icon: 'icon-plus',
                    className: 'btn-primary w-100',
                    onClick: () => this.addSupplier()
                }
            ]
        });
    }

    // === INSUMOS ===

    ls() {
        this.createTable({
            parent: 'tabla-insumos',
            data: { opc: 'ls' },
            idFilterBar: 'filterbar-productos',

            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbInsumos',
                theme: 'dark',
                title: 'Insumos registrados',
                center: [3, 4],
                right: [5],
            }
        });
    }

    addSupply() {
        this.createModalForm({
            id: 'formAddSupply',
            data: { opc: 'addSupply' },
            bootbox: { title: 'Agregar Insumo' },
            json: this.jsonSupply(),
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", title: "Agregado", text: response.message, btn1: true });
                    this.ls();
                    this.refreshCounts();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    async editSupply(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getSupply", id } });

        if (request.status !== 200) {
            alert({ icon: "error", text: request.message, btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formEditSupply',
            data: { opc: 'editSupply', id },
            bootbox: { title: 'Editar Insumo' },
            autofill: request.data,
            json: this.jsonSupply(),
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", title: "Actualizado", text: response.message, btn1: true });
                    this.ls();
                    this.refreshCounts();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    deleteSupply(id) {
        this.swalQuestion({
            opts: { title: 'Eliminar insumo?', text: 'Esta accion no se puede deshacer', icon: 'warning' },
            data: { opc: 'deleteSupply', id: id },
            methods: {
                request: () => {
                    alert({ icon: "success", text: "Insumo eliminado", timer: 1500 });
                    this.ls();
                    this.refreshCounts();
                }
            }
        });
    }

    jsonSupply() {
        return [
            { opc: "input", id: "name", lbl: "Nombre del insumo", class: "col-12 col-md-6 mb-3" },
            { opc: "input", id: "sku", lbl: "SKU (opcional)", class: "col-12 col-md-6 mb-3" },
            { opc: "select", id: "unit_id", lbl: "Unidad de medida", class: "col-12 col-md-6 mb-3", data: invUnits },
            { opc: "select", id: "supplier_id", lbl: "Proveedor", class: "col-12 col-md-6 mb-3", data: [{ id: '', valor: 'Sin proveedor' }, ...invSuppliers] },
            { opc: "input", id: "stock", lbl: "Stock actual", tipo: "numero", class: "col-12 col-md-4 mb-3" },
            { opc: "input", id: "min_stock", lbl: "Stock minimo", tipo: "numero", class: "col-12 col-md-4 mb-3" },
            { opc: "input", id: "cost", lbl: "Costo unitario", tipo: "cifra", class: "col-12 col-md-4 mb-3" },
            // { opc: "btn-submit", text: "Guardar", class: "col-12" }
        ];
    }

    // === PROVEEDORES ===

    lsProveedores() {
        this.createTable({
            parent: 'tabla-proveedores',
            data: { opc: 'lsProveedores' },
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbProveedores',
                theme: 'dark',
                title: 'Proveedores registrados',
            }
        });
    }

    addSupplier() {
        this.createModalForm({
            id: 'formAddSupplier',
            data: { opc: 'addSupplier' },
            bootbox: { title: 'Agregar Proveedor' },
            json: this.jsonSupplier(),
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", title: "Agregado", text: response.message, btn1: true });
                    this.lsProveedores();
                    this.refreshSuppliers();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    async editSupplier(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getProveedorData", id } });

        if (request.status !== 200) {
            alert({ icon: "error", text: request.message, btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formEditSupplier',
            data: { opc: 'editSupplier', id },
            bootbox: { title: 'Editar Proveedor' },
            autofill: request.data,
            json: this.jsonSupplier(),
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", title: "Actualizado", text: response.message, btn1: true });
                    this.lsProveedores();
                    this.refreshSuppliers();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    deleteSupplier(id) {
        this.swalQuestion({
            opts: { title: 'Eliminar proveedor?', text: 'Esta accion no se puede deshacer', icon: 'warning' },
            data: { opc: 'deleteSupplier', id: id },
            methods: {
                request: () => {
                    alert({ icon: "success", text: "Proveedor eliminado", timer: 1500 });
                    this.lsProveedores();
                }
            }
        });
    }

    jsonSupplier() {
        return [
            { opc: "input", id: "name", lbl: "Nombre/Razon Social", class: "col-12 mb-3" },
            { opc: "input", id: "contact_name", lbl: "Contacto", class: "col-12 col-md-6 mb-3" },
            { opc: "input", id: "phone", lbl: "Telefono", class: "col-12 col-md-6 mb-3" },
            { opc: "input", id: "email", lbl: "Email", tipo: "email", class: "col-12 col-md-6 mb-3" },
            { opc: "input", id: "rfc", lbl: "RFC", class: "col-12 col-md-6 mb-3" },
            { opc: "textarea", id: "address", lbl: "Direccion", class: "col-12 mb-3" },
            { opc: "textarea", id: "notes", lbl: "Notas", class: "col-12 mb-3" },
            { opc: "btn-submit", text: "Guardar", class: "col-12" }
        ];
    }

    // === RECETAS ===

    renderRecetasPanel() {
        const container = $('#container-recetas');
        container.html(`
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <div class="flex items-center gap-3 mb-3">
                    <select id="recetaProductSelect" class="bg-[#283341] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm flex-1">
                        <option value="">Selecciona un producto</option>
                        ${invProducts.map(p => `<option value="${p.id}">${p.valor}</option>`).join('')}
                    </select>
                    <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="inv.loadRecipe()">
                        <i class="icon-search"></i> Ver receta
                    </button>
                </div>
                <div id="recetaContent"></div>
            </div>
        `);
    }

    loadRecipe() {
        const productId = $('#recetaProductSelect').val();
        if (!productId) {
            alert({ icon: "warning", text: "Selecciona un producto", btn1: true });
            return;
        }

        $('#recetaContent').html(`
            <div class="flex justify-between items-center mb-2">
                <h3 class="text-white font-bold">Ingredientes</h3>
                <button class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm" onclick="inv.addRecipeItem(${productId})">
                    <i class="icon-plus"></i> Agregar ingrediente
                </button>
            </div>
            <div id="tabla-receta"></div>
        `);

        this.lsRecipes(productId);
    }

    lsRecipes(productId) {
        this.createTable({
            parent: 'tabla-receta',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsRecipes', product_id: productId },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: 'tbReceta',
                theme: 'dark',
                center: [1],
            }
        });
    }

    addRecipeItem(productId) {
        this.createModalForm({
            id: 'formAddRecipe',
            data: { opc: 'addRecipe', product_id: productId },
            bootbox: { title: 'Agregar Ingrediente' },
            json: [
                { opc: "select", id: "supply_id", lbl: "Insumo", class: "col-12 mb-3", data: invSupplies },
                { opc: "input", id: "quantity", lbl: "Cantidad", tipo: "numero", class: "col-12 col-md-6 mb-3" },
                { opc: "select", id: "unit_id", lbl: "Unidad", class: "col-12 col-md-6 mb-3", data: invUnits },
                { opc: "btn-submit", text: "Agregar", class: "col-12" }
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, timer: 1500 });
                    this.lsRecipes(productId);
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    deleteRecipe(id, productId) {
        this.swalQuestion({
            opts: { title: 'Eliminar ingrediente?', text: 'Se removera de la receta', icon: 'warning' },
            data: { opc: 'deleteRecipe', id: id },
            methods: {
                request: () => {
                    alert({ icon: "success", text: "Ingrediente eliminado", timer: 1500 });
                    this.lsRecipes(productId);
                }
            }
        });
    }

    // === MERMAS Y AJUSTES ===

    renderMermasPanel() {
        const container = $('#container-mermas');
        container.html(`
            <div id="filterbar-mermas" class="mb-2"></div>
            <div id="tabla-mermas"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-mermas',
            data: [
                { opc: "input-calendar", class: "col-12 col-md-4", id: "calendarMermas", lbl: "Fecha:" },
                { opc: "btn", class: "col-12 col-md-2", color_btn: "primary", text: "Buscar", fn: "inv.lsAdjustments()" },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNuevaMerma',
                    text: 'Registrar Merma/Ajuste',
                    icon: 'icon-plus',
                    className: 'btn-warning w-100',
                    onClick: () => this.addAdjustment()
                }
            ]
        });

        dataPicker({ parent: "calendarMermas", onSelect: () => this.lsAdjustments() });
        this.lsAdjustments();
    }

    lsAdjustments() {
        let rangePicker = getDataRangePicker("calendarMermas");

        this.createTable({
            parent: 'tabla-mermas',
            data: { opc: 'lsAdjustments', fi: rangePicker.fi, ff: rangePicker.ff },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbMermas',
                theme: 'dark',
                title: 'Mermas y Ajustes',
                center: [2, 3],
            }
        });
    }

    addAdjustment() {
        this.createModalForm({
            id: 'formAddAdjustment',
            data: { opc: 'addAdjustment' },
            bootbox: { title: 'Registrar Merma / Ajuste' },
            json: [
                { opc: "select", id: "supply_id", lbl: "Insumo", class: "col-12 mb-3", data: invSupplies },
                {
                    opc: "select", id: "type", lbl: "Tipo", class: "col-12 col-md-6 mb-3",
                    data: [
                        { id: 'merma', valor: 'Merma' },
                        { id: 'caducidad', valor: 'Caducidad' },
                        { id: 'danado', valor: 'Producto danado' },
                        { id: 'ajuste_positivo', valor: 'Ajuste positivo (+)' },
                        { id: 'ajuste_negativo', valor: 'Ajuste negativo (-)' }
                    ]
                },
                { opc: "input", id: "quantity", lbl: "Cantidad", tipo: "numero", class: "col-12 col-md-6 mb-3" },
                { opc: "textarea", id: "reason", lbl: "Motivo (obligatorio)", class: "col-12 mb-3" },
                { opc: "btn-submit", text: "Registrar", class: "col-12" }
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, btn1: true });
                    this.lsAdjustments();
                    this.refreshCounts();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    // === ORDENES DE COMPRA ===

    renderComprasPanel() {
        const container = $('#container-compras');
        container.html(`
            <div id="filterbar-compras" class="mb-2"></div>
            <div id="tabla-compras"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-compras',
            data: [
                { opc: "input-calendar", class: "col-12 col-md-4", id: "calendarCompras", lbl: "Fecha:" },
                { opc: "btn", class: "col-12 col-md-2", color_btn: "primary", text: "Buscar", fn: "inv.lsPurchaseOrders()" },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNuevaCompra',
                    text: 'Nueva Orden de Compra',
                    icon: 'icon-plus',
                    className: 'btn-success w-100',
                    onClick: () => this.addPurchaseOrder()
                }
            ]
        });

        dataPicker({ parent: "calendarCompras", onSelect: () => this.lsPurchaseOrders() });
        this.lsPurchaseOrders();
    }

    lsPurchaseOrders() {
        let rangePicker = getDataRangePicker("calendarCompras");

        this.createTable({
            parent: 'tabla-compras',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsPurchaseOrders', fi: rangePicker.fi, ff: rangePicker.ff },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbCompras',
                theme: 'dark',
                title: 'Ordenes de Compra',
                center: [4],
                right: [3],
            }
        });
    }

    addPurchaseOrder() {
        this.createModalForm({
            id: 'formAddPO',
            data: { opc: 'addPurchaseOrder' },
            bootbox: { title: 'Nueva Orden de Compra' },
            json: [
                { opc: "select", id: "supplier_id", lbl: "Proveedor", class: "col-12 mb-3", data: invSuppliers },
                { opc: "input", id: "expected_date", lbl: "Fecha esperada entrega", type: "date", class: "col-12 col-md-6 mb-3" },
                { opc: "textarea", id: "notes", lbl: "Notas", class: "col-12 mb-3" },
                { opc: "btn-submit", text: "Crear Orden", class: "col-12" }
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, btn1: true });
                    this.lsPurchaseOrders();
                    this.showPurchaseOrder(response.id);
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    async showPurchaseOrder(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getPurchaseOrder", id } });

        if (request.status !== 200) {
            alert({ icon: "error", text: request.message, btn1: true });
            return;
        }

        const po    = request.data;
        const items = request.items;

        let itemsHtml = '<table class="w-full text-sm text-white"><thead><tr class="border-b border-gray-600"><th class="text-left py-1">Insumo</th><th class="text-center py-1">Cant.</th><th class="text-right py-1">Costo Unit.</th><th class="text-right py-1">Total</th><th></th></tr></thead><tbody>';

        if (Array.isArray(items) && items.length > 0) {
            items.forEach(item => {
                itemsHtml += `
                    <tr class="border-b border-gray-700">
                        <td class="py-1">${item.supply_name}</td>
                        <td class="text-center py-1">${item.quantity_ordered} ${item.unit_abbr || ''}</td>
                        <td class="text-right py-1">${formatPrice(item.unit_cost)}</td>
                        <td class="text-right py-1">${formatPrice(item.total)}</td>
                        <td class="text-center py-1">
                            ${po.status === 'borrador' ? `<button class="text-red-400 hover:text-red-300 text-xs" onclick="inv.removePurchaseItem(${item.id}, ${id})"><i class="icon-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `;
            });
        } else {
            itemsHtml += '<tr><td colspan="5" class="text-center text-gray-400 py-3">Sin items</td></tr>';
        }

        itemsHtml += '</tbody></table>';

        const modalContent = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><span class="text-gray-400">Folio:</span> <span class="text-white font-bold">${po.folio}</span></div>
                    <div><span class="text-gray-400">Proveedor:</span> <span class="text-white">${po.supplier_name}</span></div>
                    <div><span class="text-gray-400">Estado:</span> <span class="text-white">${po.status}</span></div>
                    <div><span class="text-gray-400">Total:</span> <span class="text-white font-bold">${formatPrice(po.total)}</span></div>
                </div>

                ${po.status === 'borrador' ? `
                    <div class="bg-[#283341] p-3 rounded-lg space-y-2">
                        <h4 class="text-white text-sm font-bold">Agregar insumo</h4>
                        <div class="flex gap-2">
                            <select id="poSupplyId" class="flex-1 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-2 py-1.5 text-sm">
                                ${invSupplies.map(s => `<option value="${s.id}">${s.valor}</option>`).join('')}
                            </select>
                            <input id="poQty" type="number" placeholder="Cant." class="w-20 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-2 py-1.5 text-sm" min="0" step="0.01">
                            <input id="poCost" type="number" placeholder="Costo" class="w-24 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-2 py-1.5 text-sm" min="0" step="0.01">
                            <button class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm" onclick="inv.addPurchaseItem(${id})">
                                <i class="icon-plus"></i>
                            </button>
                        </div>
                    </div>
                ` : ''}

                <div id="poItemsList">${itemsHtml}</div>
            </div>
        `;

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-basket text-green-400"></i> Orden de Compra - ${po.folio}</div>`,
            message: modalContent,
            closeButton: true,
            size: 'large',
            className: 'modal-purchase-order'
        });
    }

    async addPurchaseItem(poId) {
        const supplyId = $('#poSupplyId').val();
        const qty      = parseFloat($('#poQty').val()) || 0;
        const cost     = parseFloat($('#poCost').val()) || 0;

        if (qty <= 0 || cost <= 0) {
            alert({ icon: "warning", text: "Ingresa cantidad y costo validos", btn1: true });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'addPurchaseItem',
                purchase_order_id: poId,
                supply_id: supplyId,
                quantity_ordered: qty,
                unit_cost: cost
            }
        });

        if (response.status === 200) {
            $('.modal-purchase-order').modal('hide');
            this.showPurchaseOrder(poId);
        } else {
            alert({ icon: "error", text: response.message, btn1: true });
        }
    }

    async removePurchaseItem(itemId, poId) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'deletePurchaseItem', id: itemId, purchase_order_id: poId }
        });

        if (response.status === 200) {
            $('.modal-purchase-order').modal('hide');
            this.showPurchaseOrder(poId);
        }
    }

    statusPurchaseOrder(id, newStatus) {
        let title = 'Cambiar estado?';
        let text  = `Se cambiara el estado a "${newStatus}"`;

        if (newStatus === 'recibida') {
            text = 'Se recibira la mercancia y se actualizara el stock de los insumos.';
        }

        this.swalQuestion({
            opts: { title, text, icon: 'warning' },
            data: { opc: 'statusPurchaseOrder', id: id, status: newStatus },
            methods: {
                request: (data) => {
                    alert({ icon: "success", text: data.message || "Estado actualizado", btn1: true });
                    this.lsPurchaseOrders();
                    this.refreshCounts();
                }
            }
        });
    }

    // === KARDEX ===

    renderKardexPanel() {
        const container = $('#container-kardex');
        container.html(`
            <div id="filterbar-kardex" class="mb-2"></div>
            <div id="tabla-kardex"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-kardex',
            data: [
                { opc: "input-calendar", class: "col-12 col-md-4", id: "calendarKardex", lbl: "Fecha:" },
                { opc: "btn", class: "col-12 col-md-2", color_btn: "primary", text: "Buscar", fn: "inv.lsKardex()" }
            ]
        });

        dataPicker({ parent: "calendarKardex", onSelect: () => this.lsKardex() });
        this.lsKardex();
    }

    lsKardex() {
        let rangePicker = getDataRangePicker("calendarKardex");

        this.createTable({
            parent: 'tabla-kardex',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsKardex', fi: rangePicker.fi, ff: rangePicker.ff },
            coffeesoft: true,
            conf: { datatable: true, pag: 20 },
            attr: {
                id: 'tbKardex',
                theme: 'dark',
                title: 'Historial de Movimientos (Kardex)',
                center: [2, 3, 4, 5],
            }
        });
    }

    async showKardexBySupply(supplyId) {
        const supply = await useFetch({ url: this._link, data: { opc: "getSupply", id: supplyId } });

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-list text-blue-400"></i> Kardex - ${supply.data ? supply.data.name : ''}</div>`,
            message: '<div id="tabla-kardex-supply"></div>',
            closeButton: true,
            size: 'large',
            className: 'modal-kardex-supply'
        });

        this.createTable({
            parent: 'tabla-kardex-supply',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsKardexBySupply', supply_id: supplyId },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbKardexSupply',
                theme: 'dark',
                center: [1, 2, 3, 4],
            }
        });
    }

    // === UTILIDADES ===

    async refreshCounts() {
        const req = await useFetch({ url: this._link, data: { opc: "showSupply" } });
        invCounts = req;
        this.renderCounts();
    }

    async refreshSuppliers() {
        const req = await useFetch({ url: this._link, data: { opc: "init" } });
        invSuppliers = req.suppliers || [];
        invSupplies  = req.supplies || [];
    }
}
