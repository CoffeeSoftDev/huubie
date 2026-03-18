let apiPos = 'ctrl/ctrl-pos.php';
let pos;
let posProducts = [];
let posCategories = [];
let posMethodPay = [];
let posShift = { has_open_shift: false };
let posAccess = 0;
let posSubsidiaries = [];
let posSubsidiaryId = 0;
let posSubsidiaryName = '';

$(async () => {
    const req = await useFetch({ url: apiPos, data: { opc: "init" } });
    posProducts        = req.products || [];
    posCategories      = req.categories || [];
    posMethodPay       = req.method_pay || [];
    posShift           = req.open_shift || { has_open_shift: false };
    posAccess          = req.access;
    posSubsidiaries    = req.subsidiaries || [];
    posSubsidiaryId    = req.subsidiary_id;
    posSubsidiaryName  = req.subsidiaries_name;

    pos = new POS(apiPos, 'root');

    pos.render()
});

class POS extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "POS";
        this.cart = [];
        this.searchTerm = '';
        this.activeCategory = null;
    }

    render() {
        if (!posShift.has_open_shift) {
            this.renderNoShift();
            return;
        }
        this.layoutPOS();
        this.renderProductGrid();
        this.renderCart();
    }

    renderNoShift() {
        $('#root').html(`
            <div class="flex items-center justify-center h-screen bg-[#111827]">
                <div class="text-center p-8 bg-[#1F2A37] rounded-xl shadow-lg max-w-md">
                    <i class="icon-lock text-6xl text-yellow-400 mb-4"></i>
                    <h2 class="text-xl font-bold text-white mb-2">Sin turno abierto</h2>
                    <p class="text-gray-400 mb-6">Debes abrir un turno de caja desde el modulo de Pedidos para usar el Punto de Venta.</p>
                    <button class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg" onclick="window.location.href='../pedidos/index.php'">
                        <i class="icon-arrow-left"></i> Ir a Pedidos
                    </button>
                </div>
            </div>
        `);
    }

    layoutPOS() {
        const shiftSubName = posShift.has_open_shift
            ? (posSubsidiaries.find(s => s.id == posShift.subsidiary_id)?.name || posSubsidiaryName)
            : posSubsidiaryName;

        let subsidiarySelector = '';
        if (posAccess == 1 && posSubsidiaries.length > 0) {
            const options = posSubsidiaries.map(s =>
                `<option value="${s.id}" ${s.id == posSubsidiaryId ? 'selected' : ''}>${s.name}</option>`
            ).join('');
            subsidiarySelector = `
                <select id="posSubsidiarySelect" class="bg-[#1F2A37] text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" onchange="pos.changeSubsidiary(this.value)">
                    ${options}
                </select>`;
        } else {
            subsidiarySelector = `<span class="bg-[#1F2A37] text-gray-300 px-3 py-2 rounded-lg text-sm"><i class="icon-home"></i> ${shiftSubName}</span>`;
        }

        const shiftBadge = posShift.has_open_shift
            ? `<span class="bg-green-900 text-green-300 px-3 py-2 rounded-lg text-xs font-semibold"><i class="icon-clock"></i> Turno abierto - ${shiftSubName}</span>`
            : `<span class="bg-red-900 text-red-300 px-3 py-2 rounded-lg text-xs font-semibold"><i class="icon-lock"></i> Sin turno</span>`;

        $('#root').html(`
            <div class="flex h-screen bg-[#111827] overflow-hidden">
                <div class="flex-1 flex flex-col p-3 overflow-hidden">
                    <div class="flex items-center gap-3 mb-3">
                        <button class="bg-[#1F2A37] text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-700 text-sm" onclick="window.location.href='../pedidos/index.php'">
                            <i class="icon-arrow-left"></i> Pedidos
                        </button>
                        ${subsidiarySelector}
                        ${shiftBadge}
                        <div class="flex-1 relative">
                            <i class="icon-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input id="posSearch" type="text" placeholder="Buscar producto..."
                                class="w-full bg-[#1F2A37] text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                oninput="pos.onSearch(this.value)">
                        </div>
                        <div class="flex gap-2">
                            <button class="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="pos.showSalesHistory()">
                                <i class="icon-doc-text-inv"></i> Historial
                            </button>
                            <button class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="pos.showMovements()">
                                <i class="icon-exchange"></i> Movimientos
                            </button>
                            <button class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="pos.showCorteX()">
                                <i class="icon-doc-text"></i> Corte X
                            </button>
                            <button class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="pos.showCorteZ()">
                                <i class="icon-lock"></i> Corte Z
                            </button>
                            <button class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="window.location.href='../pedidos/inventario.php'">
                                <i class="icon-box"></i> Inventario
                            </button>
                            <button class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="window.location.href='../pedidos/reportes.php'">
                                <i class="icon-chart-bar"></i> Reportes
                            </button>
                            <button class="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-semibold" onclick="window.location.href='../pedidos/cocina.php'">
                                <i class="icon-food"></i> Cocina
                            </button>
                        </div>
                    </div>
                    <div id="posCategoryTabs" class="flex gap-2 mb-3 overflow-x-auto pb-1"></div>
                    <div id="posProductGrid" class="flex-1 overflow-y-auto"></div>
                </div>
                <div id="posCartPanel" class="w-[380px] bg-[#1F2A37] flex flex-col border-l border-gray-700"></div>
            </div>
        `);

        this.renderCategoryTabs();
    }

    async changeSubsidiary(subId) {
        posSubsidiaryId = subId;
        const req = await useFetch({ url: apiPos, data: { opc: "init", subsidiary_id: subId } });
        posProducts    = req.products || [];
        posCategories  = req.categories || [];
        posMethodPay   = req.method_pay || [];
        posShift       = req.open_shift || { has_open_shift: false };
        posSubsidiaryName = posSubsidiaries.find(s => s.id == subId)?.name || '';
        this.cart = [];
        this.searchTerm = '';
        this.activeCategory = null;
        this.render();
    }

    renderCategoryTabs() {
        let html = `<button class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${!this.activeCategory ? 'bg-blue-600 text-white' : 'bg-[#1F2A37] text-gray-300 hover:bg-gray-700'}" onclick="pos.filterCategory(null)">Todos</button>`;

        posCategories.forEach(cat => {
            const active = this.activeCategory === cat.id;
            html += `<button class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${active ? 'bg-blue-600 text-white' : 'bg-[#1F2A37] text-gray-300 hover:bg-gray-700'}" onclick="pos.filterCategory(${cat.id})">${cat.text}</button>`;
        });

        $('#posCategoryTabs').html(html);
    }

    filterCategory(catId) {
        this.activeCategory = catId;
        this.renderCategoryTabs();
        this.renderProductGrid();
    }

    onSearch(value) {
        this.searchTerm = value.toLowerCase();
        this.renderProductGrid();
    }

    renderProductGrid() {
        let filtered = posProducts;

        if (this.activeCategory) {
            const catName = posCategories.find(c => c.id == this.activeCategory)?.text;
            if (catName) filtered = filtered.filter(p => p.classification === catName);
        }

        if (this.searchTerm) {
            filtered = filtered.filter(p => p.valor.toLowerCase().includes(this.searchTerm));
        }

        if (filtered.length === 0) {
            $('#posProductGrid').html(`
                <div class="flex flex-col items-center justify-center h-full text-gray-400">
                    <i class="icon-search text-5xl mb-4"></i>
                    <p class="text-lg">No se encontraron productos</p>
                </div>
            `);
            return;
        }

        let html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">';
        filtered.forEach(p => {
            const imgSrc = p.image ? `https://huubie.com.mx/alpha${p.image}` : '';
            const imgHtml = imgSrc
                ? `<img src="${imgSrc}" alt="" class="w-full h-24 object-cover rounded-t-lg">`
                : `<div class="w-full h-24 bg-gray-700 rounded-t-lg flex items-center justify-center"><i class="icon-picture text-3xl text-gray-500"></i></div>`;

            html += `
                <div class="bg-[#1F2A37] rounded-lg cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onclick="pos.addToCart(${p.id})">
                    ${imgHtml}
                    <div class="p-2">
                        <p class="text-white text-xs font-semibold truncate">${p.valor}</p>
                        <p class="text-blue-400 text-sm font-bold">${formatPrice(p.price)}</p>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        $('#posProductGrid').html(html);
    }

    addToCart(productId) {
        const product = posProducts.find(p => p.id == productId);
        if (!product) return;

        const existing = this.cart.find(i => i.id == productId);
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({
                id: product.id,
                name: product.valor,
                price: parseFloat(product.price),
                qty: 1,
                image: product.image
            });
        }

        this.renderCart();
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(i => i.id != productId);
        this.renderCart();
    }

    updateQty(productId, delta) {
        const item = this.cart.find(i => i.id == productId);
        if (!item) return;

        item.qty += delta;
        if (item.qty <= 0) {
            this.removeFromCart(productId);
            return;
        }

        this.renderCart();
    }

    clearCart() {
        this.cart = [];
        this.renderCart();
    }

    getTotal() {
        return this.cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    }

    renderCart() {
        const total = this.getTotal();
        const itemCount = this.cart.reduce((sum, i) => sum + i.qty, 0);

        if (this.cart.length === 0) {
            $('#posCartPanel').html(`
                <div class="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
                    <i class="icon-basket text-5xl mb-4"></i>
                    <p class="text-lg font-semibold">Carrito vacio</p>
                    <p class="text-sm mt-1">Selecciona productos para comenzar</p>
                </div>
                <div class="p-4 border-t border-gray-700">
                    <div class="text-sm text-gray-500 mb-1">Turno: ${posShift.shift_name || 'Abierto'}</div>
                    <div class="text-xs text-gray-600">Desde: ${posShift.opened_at || ''}</div>
                </div>
            `);
            return;
        }

        let itemsHtml = '';
        this.cart.forEach(item => {
            itemsHtml += `
                <div class="flex items-center gap-3 bg-[#283341] rounded-lg p-2 mb-2">
                    <div class="flex-1">
                        <p class="text-white text-sm font-semibold truncate">${item.name}</p>
                        <p class="text-blue-400 text-xs">${formatPrice(item.price)} c/u</p>
                    </div>
                    <div class="flex items-center gap-1">
                        <button class="w-7 h-7 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm" onclick="pos.updateQty(${item.id}, -1)">-</button>
                        <span class="text-white text-sm font-bold w-8 text-center">${item.qty}</span>
                        <button class="w-7 h-7 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm" onclick="pos.updateQty(${item.id}, 1)">+</button>
                    </div>
                    <div class="text-right w-20">
                        <p class="text-white text-sm font-bold">${formatPrice(item.price * item.qty)}</p>
                    </div>
                    <button class="text-red-400 hover:text-red-300 text-sm" onclick="pos.removeFromCart(${item.id})">
                        <i class="icon-trash"></i>
                    </button>
                </div>
            `;
        });

        $('#posCartPanel').html(`
            <div class="p-4 border-b border-gray-700">
                <div class="flex justify-between items-center">
                    <h3 class="text-white font-bold text-lg"><i class="icon-basket"></i> Carrito (${itemCount})</h3>
                    <button class="text-red-400 hover:text-red-300 text-sm" onclick="pos.clearCart()">
                        <i class="icon-trash"></i> Vaciar
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4">
                ${itemsHtml}
            </div>
            <div class="p-4 border-t border-gray-700 space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 text-lg">Total:</span>
                    <span class="text-white text-2xl font-bold">${formatPrice(total)}</span>
                </div>
                <button class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg text-lg" onclick="pos.showPayment()">
                    <i class="icon-money"></i> Cobrar
                </button>
            </div>
        `);
    }

    showPayment() {
        if (this.cart.length === 0) return;

        const total = this.getTotal();
        this.paymentSplits = [];
        this.remainingToPay = total;

        let methodOptions = posMethodPay.map(m => `<option value="${m.id}">${m.valor}</option>`).join('');

        const modalContent = `
            <div class="space-y-4">
                <div class="bg-[#1E293B] p-4 rounded-lg text-center">
                    <p class="text-sm text-gray-400">Total a cobrar</p>
                    <p id="payTotal" class="text-3xl font-bold text-white">${formatPrice(total)}</p>
                </div>

                <div id="paymentSplitList"></div>

                <div class="bg-[#283341] p-3 rounded-lg space-y-3">
                    <div class="flex gap-2">
                        <select id="payMethodSelect" class="flex-1 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                            ${methodOptions}
                        </select>
                        <input id="payAmountInput" type="number" placeholder="Monto" min="0" step="0.01"
                            class="w-32 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
                            value="${total}">
                    </div>
                    <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold" onclick="pos.addPaymentSplit()">
                        <i class="icon-plus"></i> Agregar forma de pago
                    </button>
                </div>

                <div id="payRemainingInfo" class="text-center">
                    <p class="text-sm text-gray-400">Restante: <span id="payRemaining" class="text-yellow-400 font-bold">${formatPrice(total)}</span></p>
                </div>

                <div class="flex gap-2">
                    <button class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg text-lg" onclick="pos.confirmPayment()" id="btnConfirmPay" disabled>
                        <i class="icon-ok"></i> Confirmar Pago
                    </button>
                </div>

                <div id="payChangeInfo" class="hidden bg-green-900/30 border border-green-500 p-3 rounded-lg text-center">
                    <p class="text-sm text-green-400">Cambio:</p>
                    <p id="payChangeAmount" class="text-2xl font-bold text-green-300"></p>
                </div>
            </div>
        `;

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-money text-green-400"></i> Cobrar Venta</div>`,
            message: modalContent,
            closeButton: true,
            className: 'modal-pos-payment'
        });

        $('.modal-pos-payment .modal-dialog').css('max-width', '480px');
    }

    addPaymentSplit() {
        const methodId = $('#payMethodSelect').val();
        const methodLabel = $('#payMethodSelect option:selected').text();
        const amount = parseFloat($('#payAmountInput').val()) || 0;

        if (amount <= 0) return;

        this.paymentSplits.push({
            method_id: methodId,
            label: methodLabel,
            amount: amount,
            tip: 0
        });

        this.updatePaymentUI();
    }

    removePaymentSplit(index) {
        this.paymentSplits.splice(index, 1);
        this.updatePaymentUI();
    }

    updatePaymentUI() {
        const total = this.getTotal();
        const totalPaid = this.paymentSplits.reduce((s, p) => s + p.amount, 0);
        const remaining = total - totalPaid;
        const change = totalPaid > total ? totalPaid - total : 0;

        let listHtml = '';
        this.paymentSplits.forEach((p, i) => {
            listHtml += `
                <div class="flex justify-between items-center bg-[#283341] p-2 rounded-lg mb-1">
                    <span class="text-white text-sm"><i class="icon-money"></i> ${p.label}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400 font-bold text-sm">${formatPrice(p.amount)}</span>
                        <button class="text-red-400 hover:text-red-300 text-xs" onclick="pos.removePaymentSplit(${i})"><i class="icon-cancel"></i></button>
                    </div>
                </div>
            `;
        });

        $('#paymentSplitList').html(listHtml);
        $('#payRemaining').text(formatPrice(remaining > 0 ? remaining : 0));
        $('#payAmountInput').val(remaining > 0 ? remaining.toFixed(2) : '');

        if (totalPaid >= total) {
            $('#btnConfirmPay').prop('disabled', false).removeClass('opacity-50');
            if (change > 0) {
                $('#payChangeInfo').removeClass('hidden');
                $('#payChangeAmount').text(formatPrice(change));
            } else {
                $('#payChangeInfo').addClass('hidden');
            }
        } else {
            $('#btnConfirmPay').prop('disabled', true).addClass('opacity-50');
            $('#payChangeInfo').addClass('hidden');
        }
    }

    async confirmPayment() {
        const total = this.getTotal();
        const totalPaid = this.paymentSplits.reduce((s, p) => s + p.amount, 0);

        if (totalPaid < total) return;

        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'addQuickSale',
                items: JSON.stringify(this.cart),
                payments: JSON.stringify(this.paymentSplits),
                total: total,
                note: ''
            }
        });

        if (response.status === 200) {
            $('.modal-pos-payment').modal('hide');

            const orderId = response.order_id;
            const change = response.change || 0;

            if (typeof tickets !== 'undefined') {
                await useFetch({
                    url: 'ctrl/ctrl-inventario.php',
                    data: {
                        opc: 'deductStockBySale',
                        items: JSON.stringify(this.cart),
                        order_id: orderId
                    }
                });

                this.cart = [];
                this.paymentSplits = [];
                this.renderCart();

                tickets.printSaleTicket(orderId);
            } else {
                let changeHtml = '';
                if (change > 0) {
                    changeHtml = `<br><br><div class="bg-green-900/30 border border-green-500 p-3 rounded-lg inline-block"><p class="text-sm text-green-400">Cambio:</p><p class="text-2xl font-bold text-green-300">${formatPrice(change)}</p></div>`;
                }

                alert({
                    icon: "success",
                    title: "Venta registrada",
                    html: `Folio #${orderId} - Total: ${formatPrice(total)}${changeHtml}`,
                    btn1: true,
                    btn1Text: "Nueva venta"
                });

                this.cart = [];
                this.paymentSplits = [];
                this.renderCart();
            }
        } else {
            alert({ icon: "error", text: response.message, btn1: true });
        }
    }

    showMovements() {
        if (!posShift.has_open_shift) {
            alert({ icon: "warning", text: "No hay turno abierto", btn1: true });
            return;
        }

        const modalContent = `
            <div class="space-y-4">
                <div class="bg-[#283341] p-3 rounded-lg space-y-3">
                    <div class="flex gap-2">
                        <select id="movType" class="flex-1 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                            <option value="retiro">Retiro</option>
                            <option value="deposito">Deposito</option>
                            <option value="gasto">Gasto operativo</option>
                        </select>
                        <input id="movAmount" type="number" placeholder="Monto" min="0" step="0.01"
                            class="w-32 bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                    </div>
                    <input id="movReason" type="text" placeholder="Motivo del movimiento"
                        class="w-full bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                    <button class="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-semibold" onclick="pos.saveMovement()">
                        <i class="icon-plus"></i> Registrar Movimiento
                    </button>
                </div>
                <div id="containerMovements"></div>
            </div>
        `;

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-exchange text-orange-400"></i> Movimientos de Caja</div>`,
            message: modalContent,
            closeButton: true,
            size: 'large',
            className: 'modal-movements'
        });

        this.lsMovements();
    }

    async saveMovement() {
        const type   = $('#movType').val();
        const amount = parseFloat($('#movAmount').val()) || 0;
        const reason = $('#movReason').val();

        if (amount <= 0) {
            alert({ icon: "warning", text: "Ingresa un monto valido", btn1: true });
            return;
        }

        if (!reason.trim()) {
            alert({ icon: "warning", text: "Ingresa el motivo del movimiento", btn1: true });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'addMovement',
                cash_shift_id: posShift.shift_id,
                type: type,
                amount: amount,
                reason: reason
            }
        });

        if (response.status === 200) {
            alert({ icon: "success", text: response.message, timer: 1500 });
            $('#movAmount').val('');
            $('#movReason').val('');
            this.lsMovements();
        } else {
            alert({ icon: "error", text: response.message, btn1: true });
        }
    }

    lsMovements() {
        this.createTable({
            parent: 'containerMovements',
            idFilterBar:'filterbar-productos',
            data: { 
                opc: 'lsMovements', 
                cash_shift_id: 
                posShift.shift_id 
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbMovimientos',
                theme: 'dark',
                center: [1],
                right: [2],
            }
        });
    }

    async deleteMovement(id, shift_id) {
        this.swalQuestion({
            opts: {
                title: 'Eliminar movimiento?',
                text: 'Esta accion no se puede deshacer',
                icon: 'warning'
            },
            data: { opc: 'deleteMovement', id: id },
            methods: {
                request: (data) => {
                    alert({ icon: "success", text: "Movimiento eliminado", timer: 1500 });
                    this.lsMovements();
                }
            }
        });
    }

    async showCorteX() {
        if (!posShift.has_open_shift) {
            alert({ icon: "warning", text: "No hay turno abierto para generar Corte X", btn1: true });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: { opc: 'showCorteX', shift_id: posShift.shift_id }
        });

        if (response.status !== 200) {
            alert({ icon: "error", text: response.message, btn1: true });
            return;
        }

        const d = response.data;
        const shift = response.shift;
        const subName = response.subsidiary_name;
        const logo = response.logo;

        const ticketHtml = `
            <div class="flex justify-center p-4">
                <div id="ticketCorteX" class="bg-white p-4 rounded-lg shadow-lg font-mono text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%;">
                    <div class="flex flex-col items-center mb-3">
                        ${logo ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;" class="mb-1">
                            <img src="https://huubie.com.mx/alpha${logo}" alt="" style="width:100%;height:100%;object-fit:cover;" />
                        </div>` : ''}
                        <h1 class="text-sm font-bold uppercase">${subName}</h1>
                        <div class="text-xs font-bold text-indigo-700">CORTE X - PARCIAL</div>
                        <div class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">TURNO ABIERTO</div>
                    </div>

                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Cajero:</span><span>${shift.employee_name || 'N/A'}</span></div>
                        <div class="flex justify-between"><span>Fecha:</span><span>${moment().format('DD/MM/YYYY HH:mm')}</span></div>
                        <div class="flex justify-between"><span>Turno abierto:</span><span>${moment(shift.opened_at).format('HH:mm')}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs font-bold mb-1">VENTAS</div>
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Efectivo:</span><span>${formatPrice(d.cash_sales)}</span></div>
                        <div class="flex justify-between"><span>Tarjeta:</span><span>${formatPrice(d.card_sales)}</span></div>
                        <div class="flex justify-between"><span>Transferencia:</span><span>${formatPrice(d.transfer_sales)}</span></div>
                        <div class="flex justify-between font-bold"><span>TOTAL:</span><span>${formatPrice(d.total_sales)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs font-bold mb-1">MOVIMIENTOS</div>
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Fondo inicial:</span><span>${formatPrice(d.opening_amount)}</span></div>
                        <div class="flex justify-between"><span>Retiros:</span><span class="text-red-600">-${formatPrice(d.total_retiros)}</span></div>
                        <div class="flex justify-between"><span>Depositos:</span><span>${formatPrice(d.total_depositos)}</span></div>
                        ${d.total_gastos > 0 ? `<div class="flex justify-between"><span>Gastos:</span><span class="text-red-600">-${formatPrice(d.total_gastos)}</span></div>` : ''}
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between font-bold text-sm"><span>EFECTIVO EN CAJA:</span><span>${formatPrice(d.cash_in_drawer)}</span></div>
                        <div class="text-[10px] text-gray-500 italic">(fondo + ventas efectivo - retiros + depositos)</div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Pedidos creados:</span><span>${d.total_orders}</span></div>
                        <div class="flex justify-between"><span>Cotizaciones:</span><span>${d.quotation_count}</span></div>
                        <div class="flex justify-between"><span>Pendientes:</span><span>${d.pending_count}</span></div>
                        <div class="flex justify-between"><span>Cancelados:</span><span>${d.cancelled_count}</span></div>
                        <div class="flex justify-between"><span>Descuentos:</span><span>${formatPrice(d.total_discount)}</span></div>
                    </div>

                    <div class="text-center mt-4 text-[10px] text-gray-500">
                        <p class="font-bold text-gray-900">* Este corte NO cierra el turno</p>
                        <p>Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                    </div>
                </div>
            </div>
        `;

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-doc-text text-indigo-400"></i> Corte X - Parcial</div>`,
            message: `
                ${ticketHtml}
                <div class="flex justify-center gap-2 mt-3">
                    <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="pos.printTicket('ticketCorteX')">
                        <i class="icon-print"></i> Imprimir
                    </button>
                </div>
            `,
            closeButton: true,
            className: 'modal-corte-x'
        });

        $('.modal-corte-x .modal-dialog').css('max-width', '420px');
    }

    showCorteZ() {
        if (!posShift.has_open_shift) {
            alert({ icon: "warning", text: "No hay turno abierto para realizar Corte Z", btn1: true });
            return;
        }

        Swal.fire({
            title: 'Corte Z - Cierre Definitivo',
            html: `
                <div class="text-left space-y-3">
                    <div class="bg-red-900/30 border border-red-500 p-3 rounded-lg">
                        <p class="text-sm text-red-400 font-semibold">Este corte cerrara el turno de forma definitiva.</p>
                        <p class="text-xs text-red-300 mt-1">No se podran registrar mas ventas en este turno.</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-300 block mb-1">Efectivo contado en caja</label>
                        <input id="swalCashCounted" type="number" class="swal2-input" style="background:#374151;border:1px solid #4b5563;color:#fff;border-radius:6px;padding:8px 12px;font-size:14px;width:100%;margin:0;" placeholder="0.00" min="0" step="0.01">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Cerrar Turno (Corte Z)',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#7c3aed',
            customClass: {
                popup: 'bg-[#1F2A37] text-white rounded-lg',
            },
            preConfirm: () => {
                const val = parseFloat(document.getElementById('swalCashCounted').value);
                if (isNaN(val) || val < 0) {
                    Swal.showValidationMessage('Ingresa el monto de efectivo contado');
                    return false;
                }
                return { closing_cash_counted: val };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await useFetch({
                    url: this._link,
                    data: {
                        opc: 'showCorteZ',
                        shift_id: posShift.shift_id,
                        closing_cash_counted: result.value.closing_cash_counted
                    }
                });

                if (response.status === 200) {
                    posShift = { has_open_shift: false };
                    this.renderCorteZTicket(response);
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    renderCorteZTicket(response) {
        const d = response.data;
        const shift = response.shift;
        const subName = response.subsidiary_name;
        const logo = response.logo;
        const folioZ = response.folio_z;

        let topProductsHtml = '';
        if (d.top_products && d.top_products.length > 0) {
            topProductsHtml = `
                <hr class="border-dashed border-t my-1" />
                <div class="text-xs font-bold mb-1">DETALLE DE PRODUCTOS</div>
                <div class="text-xs space-y-0.5">
                    ${d.top_products.map(p => `
                        <div class="flex justify-between">
                            <span>${p.name} x${p.quantity}</span>
                            <span>${formatPrice(p.total)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const diffClass = d.cash_difference < 0 ? 'text-red-600' : d.cash_difference > 0 ? 'text-green-600' : '';
        const diffSign = d.cash_difference >= 0 ? '+' : '';

        const ticketHtml = `
            <div class="flex justify-center p-4">
                <div id="ticketCorteZ" class="bg-white p-4 rounded-lg shadow-lg font-mono text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%;">
                    <div class="flex flex-col items-center mb-3">
                        ${logo ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;" class="mb-1">
                            <img src="https://huubie.com.mx/alpha${logo}" alt="" style="width:100%;height:100%;object-fit:cover;" />
                        </div>` : ''}
                        <h1 class="text-sm font-bold uppercase">${subName}</h1>
                        <div class="text-xs font-bold text-purple-700">CORTE Z - CIERRE DEFINITIVO</div>
                        <div class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">CERRADO</div>
                    </div>

                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Cajero:</span><span>${shift.employee_name || 'N/A'}</span></div>
                        <div class="flex justify-between"><span>Fecha:</span><span>${moment(shift.opened_at).format('DD/MM/YYYY')}</span></div>
                        <div class="flex justify-between"><span>Turno:</span><span>${moment(shift.opened_at).format('HH:mm')} - ${moment(shift.closed_at).format('HH:mm')}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs font-bold mb-1">RESUMEN DE VENTAS</div>
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Total bruto:</span><span>${formatPrice(d.total_sales)}</span></div>
                        <div class="flex justify-between"><span>Descuentos:</span><span class="text-red-600">-${formatPrice(d.total_discount)}</span></div>
                        <div class="flex justify-between"><span>Cancelaciones:</span><span class="text-red-600">-${formatPrice(d.total_cancelled)}</span></div>
                        <div class="flex justify-between font-bold"><span>Total neto:</span><span>${formatPrice(d.total_net)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs font-bold mb-1">DESGLOSE POR FORMA DE PAGO</div>
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Efectivo:</span><span>${formatPrice(d.cash_sales)}</span></div>
                        <div class="flex justify-between"><span>Tarjeta:</span><span>${formatPrice(d.card_sales)}</span></div>
                        <div class="flex justify-between"><span>Transferencia:</span><span>${formatPrice(d.transfer_sales)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs font-bold mb-1">MOVIMIENTOS DE CAJA</div>
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Fondo inicial:</span><span>${formatPrice(d.opening_amount)}</span></div>
                        <div class="flex justify-between"><span>Retiros:</span><span class="text-red-600">-${formatPrice(d.total_retiros)}</span></div>
                        <div class="flex justify-between"><span>Depositos:</span><span>${formatPrice(d.total_depositos)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs font-bold mb-1">CUADRE DE CAJA</div>
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Efectivo esperado:</span><span>${formatPrice(d.cash_expected)}</span></div>
                        <div class="flex justify-between"><span>Efectivo contado:</span><span>${formatPrice(d.closing_cash_counted)}</span></div>
                        <div class="flex justify-between font-bold ${diffClass}"><span>Diferencia:</span><span>${diffSign}${formatPrice(d.cash_difference)}</span></div>
                    </div>

                    ${topProductsHtml}

                    <hr class="border-dashed border-t my-1" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span>Pedidos totales:</span><span>${d.total_orders}</span></div>
                        <div class="flex justify-between"><span>Pendientes:</span><span>${d.pending_count}</span></div>
                        <div class="flex justify-between"><span>Cancelados:</span><span>${d.cancelled_count}</span></div>
                    </div>

                    <div class="text-center mt-4 text-[10px] space-y-1">
                        <p class="font-bold text-gray-900">Turno cerrado: ${moment(shift.closed_at).format('HH:mm')}</p>
                        <p class="font-bold text-purple-800">Folio: ${folioZ}</p>
                        <p class="font-bold text-red-600">* CIERRE DEFINITIVO</p>
                        <p class="text-gray-500">No se pueden registrar mas ventas en este turno</p>
                    </div>
                </div>
            </div>
        `;

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-lock text-purple-400"></i> Corte Z - ${folioZ}</div>`,
            message: `
                ${ticketHtml}
                <div class="flex justify-center gap-2 mt-3">
                    <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="pos.printTicket('ticketCorteZ')">
                        <i class="icon-print"></i> Imprimir
                    </button>
                    <button class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="window.location.href='../pedidos/index.php'">
                        <i class="icon-arrow-left"></i> Volver a Pedidos
                    </button>
                </div>
            `,
            closeButton: true,
            className: 'modal-corte-z'
        });

        $('.modal-corte-z .modal-dialog').css('max-width', '420px');
    }

    showSalesHistory() {
        if (!posShift.has_open_shift) {
            alert({ icon: "warning", text: "No hay turno abierto", btn1: true });
            return;
        }

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-doc-text-inv text-cyan-400"></i> Historial de Ventas del Turno</div>`,
            message: '<div id="containerSalesHistory"></div>',
            closeButton: true,
            size: 'large',
            className: 'modal-sales-history'
        });

        if (typeof tickets !== 'undefined') {
            tickets.createTable({
                parent: 'containerSalesHistory',
                data: { opc: 'lsSales', fi: moment(posShift.opened_at).format('YYYY-MM-DD'), ff: moment().format('YYYY-MM-DD') },
                coffeesoft: true,
                conf: { datatable: true, pag: 10 },
                attr: {
                    id: 'tbSalesHistory',
                    theme: 'dark',
                    center: [4, 5],
                    right: [3],
                }
            });
        }
    }

    printTicket(elementId) {
        const ticketContent = document.getElementById(elementId);
        if (!ticketContent) return;

        let ticketType = 'venta';
        if (elementId === 'ticketCorteX') ticketType = 'corte_x';
        if (elementId === 'ticketCorteZ') ticketType = 'corte_z';

        if (typeof tickets !== 'undefined') {
            useFetch({
                url: 'ctrl/ctrl-tickets.php',
                data: {
                    opc: 'addTicketLog',
                    order_id: 0,
                    cash_shift_id: posShift.shift_id || 0,
                    type: ticketType
                }
            });
        }

        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Ticket</title>');
        printWindow.document.write(`
            <style>
                body { font-family: 'Courier New', monospace; padding: 10px; max-width: 320px; margin: 0 auto; }
                .bg-white { background-color: white; }
                .p-4 { padding: 1rem; }
                .rounded-lg { border-radius: 0.5rem; }
                .font-mono { font-family: 'Courier New', monospace; }
                .text-gray-900 { color: #111827; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .mb-3 { margin-bottom: 0.75rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-1 { margin-bottom: 0.25rem; }
                .mt-4 { margin-top: 1rem; }
                .mt-1 { margin-top: 0.25rem; }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .text-\\[10px\\] { font-size: 10px; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .text-gray-500, .text-gray-600 { color: #6B7280; }
                .text-center { text-align: center; }
                .uppercase { text-transform: uppercase; }
                .text-red-600 { color: #dc2626; }
                .text-green-600 { color: #16a34a; }
                .text-purple-700, .text-purple-800 { color: #6B21A8; }
                .text-indigo-700 { color: #4338ca; }
                .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
                .space-y-1 > * + * { margin-top: 0.25rem; }
                hr { border: 0; border-top: 1px dashed #D1D5DB; margin: 0.5rem 0; }
                .bg-green-100, .bg-blue-100 { padding: 2px 8px; border-radius: 9999px; display: inline-block; }
                .bg-green-100 { background: #dcfce7; color: #166534; }
                .bg-blue-100 { background: #dbeafe; color: #1e40af; }
                .italic { font-style: italic; }
                @media print { body { padding: 0; } }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketContent.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 250);
    }
}
