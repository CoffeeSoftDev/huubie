let api = 'ctrl/ctrl-pos-main.php';
let app, productos, carrito, promociones, posMainView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    posMainView = new PosMainView(api, 'root');
    productos   = new Productos(api, 'root');
    carrito     = new Carrito(api, 'root');
    promociones = new Promociones(api, 'root');
    app         = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME    = 'PosMain';
        this.subId           = null;
        this.activeCategory  = 'Todos';
        this.searchQuery     = '';
        this.selectedCliente = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            sucursales:  SAMPLE_POSMAIN_SUCURSALES,
            categorias:  SAMPLE_POSMAIN_CATEGORIAS,
            productos:   SAMPLE_POSMAIN_PRODUCTOS,
            promociones: SAMPLE_POSMAIN_PROMOCIONES,
            metodosPago: SAMPLE_POSMAIN_METODOS_PAGO,
            clientes:    SAMPLE_POSMAIN_CLIENTES,
            turno:       SAMPLE_POSMAIN_TURNO
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;
        turno           = this.dataInit.turno;

        this.render();
    }

    render() {
        this.layout();
        posMainView.renderHeader(SAMPLE_VIEW_HEADER_POSMAIN);
        posMainView.renderFooter(SAMPLE_VIEW_FOOTER_POSMAIN);
        posMainView.renderTurnoBar(this.dataInit.turno);
        posMainView.renderClienteBar(this.dataInit.clientes);
        posMainView.renderCobroModal({
            metodosPago: this.dataInit.metodosPago
        });

        // Render inicial del POS
        productos.lsCategorias();
        productos.lsProductos();
        carrito.refresh();
    }

    // -- Layout --

    layout() {

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'turnoBar',
                    class: 'flex items-center justify-between px-4 py-2.5 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'searchAndCategories',
                    class: 'px-4 pt-3 pb-2 space-y-2 flex-shrink-0 bg-[#0E1521]'
                },
                {
                    id:    'productGridWrap',
                    class: 'flex-1 overflow-y-auto px-4 pb-3'
                },
                {
                    id:    'viewFooter',
                    text:  '#viewFooter',
                    class: 'px-4 py-2 bg-[#141d2b] border-t border-[#374151] flex items-center justify-between flex-shrink-0'
                }
            ]
        };

        const cartPanel = {
            type: 'aside',
            id:   'cartPanel',
            class:'w-full md:w-[40%] md:max-w-[520px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                { id: 'cartHeader',         class: 'px-4 py-3 border-b border-[#374151] flex-shrink-0' },
                { id: 'promoBannersWrap',   class: 'hidden px-3 pt-2 space-y-1.5 flex-shrink-0'        },
                { id: 'cartItemsWrap',      class: 'flex-1 overflow-y-auto px-3 py-2 space-y-1.5'     },
                { id: 'cartEmpty',          class: 'hidden flex-col items-center justify-center text-center px-4 py-8 flex-1' },
                { id: 'cartFooter',         class: 'border-t border-[#374151] px-4 py-3 flex-shrink-0' }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'mt-16 h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, cartPanel]
            }
        });

        // El panel de catalogo necesita el grid de productos como hijo del wrap
        $('#productGridWrap').html(`
            <div id="productGrid" class="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3"></div>
            <div id="productEmpty" class="hidden flex flex-col items-center justify-center py-10 text-center">
                <div class="w-12 h-12 rounded-full bg-[#1a2332] border border-[#374151] flex items-center justify-center mb-2">
                    <i data-lucide="search-x" class="w-5 h-5 text-[#6B7280]"></i>
                </div>
                <p class="text-[11px] text-[#6B7280]">Sin productos para esta busqueda</p>
            </div>
        `);

        $('#searchAndCategories').html(`
            <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]"></i>
                <input id="inputSearch" type="text" placeholder="Buscar producto o escanear..."
                       class="pl-9 pr-4 py-2 text-xs w-full"
                       style="background:#1a2332;border:1px solid #374151;color:#fff;border-radius:8px;">
            </div>
            <div id="catContainer" class="flex gap-1.5 overflow-x-auto pb-1"></div>
        `);

        $('#inputSearch').on('input', (e) => this.onChangeSearch(e.target.value));

        if (window.lucide) lucide.createIcons();
    }

    // -- Event handlers --

    onChangeSearch(value) {
        this.searchQuery = value || '';
        productos.lsProductos();
    }

    onChangeCategory(category) {
        this.activeCategory = category;
        productos.lsCategorias();
        productos.lsProductos();
    }

    // -- Facade --

    getFilters() {
        return {
            subsidiaries_id: this.subId || '',
            category:        this.activeCategory || 'Todos',
            q:               this.searchQuery || ''
        };
    }

    addProduct(productId) {
        carrito.addItem(productId);
    }

    selectCliente(cliente) {
        this.selectedCliente = cliente || null;
    }

    openCobroModal() {
        if (carrito.getCart().length === 0) {
            this.showWarn('Ticket vacio', 'Agrega al menos un producto al ticket antes de cobrar.');
            return;
        }
        posMainView.openCobroModal({
            totals:          carrito.computeTotals(),
            selectedCliente: this.selectedCliente
        });
    }

    showWarn(title, text) {
        if (typeof Swal === 'undefined') {
            alert(title + '\n' + text);
            return;
        }
        Swal.fire({
            customClass:    { popup: 'huubie-swal' },
            buttonsStyling: false,
            icon:           'warning',
            title:          title,
            text:           text,
            confirmButtonText: 'Entendido'
        });
    }

    showSuccess(title, text, timer) {
        if (typeof Swal === 'undefined') {
            alert(title + '\n' + text);
            return;
        }
        Swal.fire({
            customClass:    { popup: 'huubie-swal' },
            buttonsStyling: false,
            icon:           'success',
            title:          title,
            html:           text,
            timer:          timer || 1800,
            timerProgressBar: !!timer,
            showConfirmButton: !timer,
            confirmButtonText: 'Aceptar'
        });
    }
}


class Productos extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'PosMain';
    }

    // -- Data --

    getProductos() {
        return SAMPLE_POSMAIN_PRODUCTOS;
    }

    getProductoById(id) {
        return SAMPLE_POSMAIN_PRODUCTOS.find(p => p.id === id) || null;
    }

    lsCategorias() {
        const wrap = $('#catContainer');
        if (!wrap.length) return;
        const f = app.getFilters();
        wrap.html(SAMPLE_POSMAIN_CATEGORIAS.map(cat => {
            const isActive = cat === f.category;
            const base     = 'cat-btn flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[#374151] cursor-pointer';
            const variant  = isActive
                ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                : 'bg-[#1a2332] text-[#9CA3AF] hover:bg-[#243042]';
            return `<button type="button" class="${base} ${variant}" data-cat="${cat}">${cat}</button>`;
        }).join(''));

        wrap.find('[data-cat]').on('click', (e) => {
            app.onChangeCategory($(e.currentTarget).attr('data-cat'));
        });
    }

    lsProductos() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'lsProductos' }, app.getFilters()) })
        const f       = app.getFilters();
        const q       = (f.q || '').trim().toLowerCase();
        const filtered = SAMPLE_POSMAIN_PRODUCTOS.filter(p => {
            const matchCat    = f.category === 'Todos' || p.category === f.category;
            const matchSearch = !q
                || p.name.toLowerCase().includes(q)
                || p.id.toLowerCase().includes(q);
            return matchCat && matchSearch;
        });

        posMainView.renderProductGrid({
            productos:   filtered,
            promociones: SAMPLE_POSMAIN_PROMOCIONES
        });
    }
}


class Carrito extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'PosMain';
        this._cart        = [];
        this._lineSeq     = 1;
        this._accountDiscount = null;
    }

    // -- Data --

    getCart() {
        return this._cart;
    }

    nextLineId() {
        return 'L' + (this._lineSeq++);
    }

    isComboChild(it) {
        return !!it.comboId;
    }

    cartHeaders() {
        return this._cart.filter(it => !this.isComboChild(it));
    }

    // -- Actions --

    addItem(productId) {
        const p = productos.getProductoById(productId);
        if (!p || p.stock <= 0) return;

        if (p.isCombo) {
            const header = this._cart.find(it => it.id === productId && !it.comboId);
            if (header) {
                header.qty += 1;
                this._cart.forEach(it => {
                    if (it.comboId === header.lineId) {
                        const recipe = (p.components || []).find(c => c.productId === it.id);
                        if (recipe) it.qty = recipe.quantity * header.qty;
                    }
                });
            } else {
                const headerId = this.nextLineId();
                this._cart.push({ lineId: headerId, id: productId, qty: 1, discount: 0, comboId: null });
                (p.components || []).forEach(c => {
                    this._cart.push({ lineId: this.nextLineId(), id: c.productId, qty: c.quantity, discount: 0, comboId: headerId });
                });
            }
        } else {
            const existing = this._cart.find(it => it.id === productId && !it.comboId);
            if (existing) {
                existing.qty += 1;
            } else {
                this._cart.push({ lineId: this.nextLineId(), id: productId, qty: 1, discount: 0, comboId: null });
            }
        }
        this.refresh();
    }

    changeQty(lineId, delta) {
        const it = this._cart.find(x => x.lineId === lineId);
        if (!it) return;
        if (this.isComboChild(it)) return;

        const p = productos.getProductoById(it.id);
        const newQty = it.qty + delta;
        if (newQty <= 0) {
            this.removeItem(lineId);
            return;
        }
        it.qty = newQty;
        if (p && p.isCombo) {
            this._cart.forEach(child => {
                if (child.comboId === it.lineId) {
                    const recipe = (p.components || []).find(c => c.productId === child.id);
                    if (recipe) child.qty = recipe.quantity * newQty;
                }
            });
        }
        this.refresh();
    }

    removeItem(lineId) {
        const it = this._cart.find(x => x.lineId === lineId);
        if (!it) return;
        for (let i = this._cart.length - 1; i >= 0; i--) {
            if (this._cart[i].lineId === lineId || this._cart[i].comboId === lineId) {
                this._cart.splice(i, 1);
            }
        }
        this.refresh();
    }

    clear() {
        this._cart.length = 0;
        this._accountDiscount = null;
        promociones.reset();
        this.refresh();
    }

    // -- Compute / Refresh --

    computeTotals() {
        promociones.resolve(this);

        const bxgyApplied = promociones.getApplied();
        let subtotal       = 0;
        let descuentoItems = 0;

        this.cartHeaders().forEach(it => {
            const p = productos.getProductoById(it.id);
            if (!p) return;
            const bruto = p.price * it.qty;
            const dPct  = it.discount || 0;
            subtotal      += bruto;
            descuentoItems += bruto * (dPct / 100);
        });

        const descuentoPromo  = bxgyApplied.reduce((s, a) => s + a.amountSaved, 0);
        const baseTrasItems   = subtotal - descuentoItems - descuentoPromo;

        let descuentoCuenta = 0;
        if (this._accountDiscount) {
            if (this._accountDiscount.type === 'porcentaje') {
                descuentoCuenta = baseTrasItems * (this._accountDiscount.value / 100);
            } else if (this._accountDiscount.type === 'monto') {
                descuentoCuenta = Math.min(this._accountDiscount.value, baseTrasItems);
            }
        }

        const descuento  = descuentoItems + descuentoCuenta;
        const total      = subtotal - descuento - descuentoPromo;
        const itemsCount = this.cartHeaders().length;
        const piezas     = this.cartHeaders().reduce((s, it) => s + it.qty, 0);

        return {
            subtotal, descuentoItems, descuentoPromo, descuentoCuenta, descuento, total,
            itemsCount, piezas, bxgyApplied
        };
    }

    refresh() {
        const totals = this.computeTotals();
        posMainView.renderCart({
            cart:         this._cart,
            cartHeaders:  this.cartHeaders(),
            totals:       totals,
            freeLineIds:  promociones.getFreeLineIds(),
            bxgyApplied:  totals.bxgyApplied,
            bxgyUpsell:   promociones.getUpsell(),
            promociones:  SAMPLE_POSMAIN_PROMOCIONES
        });
    }
}


class Promociones extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME  = 'PosMain';
        this._applied      = [];
        this._upsell       = [];
        this._freeLineIds  = new Set();
    }

    // -- Data --

    getApplied()     { return this._applied;     }
    getUpsell()      { return this._upsell;      }
    getFreeLineIds() { return this._freeLineIds; }

    reset() {
        this._applied = [];
        this._upsell  = [];
        this._freeLineIds.clear();
    }

    // -- Engine BXGY (Buy X, Get Y Free) --

    resolve(cartInstance) {
        this.reset();

        const byPromo = {};
        cartInstance.cartHeaders().forEach(it => {
            const p = productos.getProductoById(it.id);
            if (!p || !p.promoId || p.promoType !== 'BXGY') return;
            if (!byPromo[p.promoId]) byPromo[p.promoId] = [];
            for (let i = 0; i < it.qty; i++) {
                byPromo[p.promoId].push({
                    lineId:    it.lineId,
                    productId: p.id,
                    name:      p.name,
                    price:     p.price,
                    slotIndex: i
                });
            }
        });

        Object.values(SAMPLE_POSMAIN_PROMOCIONES).forEach(promo => {
            if (promo.type !== 'BXGY') return;
            const pool          = byPromo[promo.id] || [];
            const eligibleCount = pool.length;

            if (eligibleCount === 0) return;

            const setsApplied     = Math.floor(eligibleCount / promo.buy);
            const itemsFreePerSet = promo.buy - promo.pay;
            const totalFree       = setsApplied * itemsFreePerSet;

            if (setsApplied === 0) {
                const missing = promo.buy - eligibleCount;
                if (missing > 0 && missing < promo.buy) {
                    this._upsell.push({
                        promoId:    promo.id,
                        promoName:  promo.name,
                        badgeClass: promo.badgeClass,
                        label:      promo.label,
                        missing,
                        current:    eligibleCount,
                        buy:        promo.buy,
                        tagline:    promo.tagline
                    });
                }
                return;
            }

            const sorted    = [...pool].sort((a, b) => a.price - b.price);
            const freeSlots = sorted.slice(0, totalFree);
            freeSlots.forEach(s => this._freeLineIds.add(s.lineId));

            const amountSaved = freeSlots.reduce((sum, s) => sum + s.price, 0);

            this._applied.push({
                promoId:        promo.id,
                promoName:      promo.name,
                badgeClass:     promo.badgeClass,
                label:          promo.label,
                setsApplied:    setsApplied,
                itemsFree:      totalFree,
                amountSaved:    amountSaved,
                freeItems:      freeSlots.map(s => ({ name: s.name, price: s.price })),
                eligibleInCart: eligibleCount,
                tagline:        promo.tagline
            });
        });
    }
}


class PosMainView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'PosMain';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    renderTurnoBar(data) {
        const t = data || {};
        const html = `
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5 px-2.5 py-1 bg-[rgba(63,193,137,0.12)] border border-[rgba(63,193,137,0.3)] rounded-lg">
                    <div class="w-1.5 h-1.5 rounded-full bg-[#3FC189] pulse-dot"></div>
                    <span class="text-[10px] font-semibold text-[#3FC189]">${this.esc(t.label || 'TURNO')}</span>
                </div>
                <span class="text-[10px] text-[#6B7280]">${this.esc(t.sucursal || '-')} &mdash; ${this.esc(t.cajero || '-')}</span>
            </div>
            <div class="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
                <span>Ventas: <strong class="text-[#3FC189]">${this.fmtMoneyShort(t.ventas || 0)}</strong></span>
                <span class="text-[#374151]">|</span>
                <span>Ordenes: <strong class="text-white">${t.ordenes || 0}</strong></span>
            </div>
        `;
        $('#turnoBar').html(html);
    }

    renderClienteBar(clientesList) {
        // Bloque integrado al cartHeader; se rellena en renderCart
        this._clientes = clientesList || [];
    }

    renderProductGrid(opts) {
        const productosList = opts.productos || [];
        const promos        = opts.promociones || {};

        const grid  = $('#productGrid');
        const empty = $('#productEmpty');

        if (!productosList.length) {
            grid.html('');
            empty.removeClass('hidden');
            return;
        }
        empty.addClass('hidden');

        grid.html(productosList.map(p => this.productCard({
            producto:   p,
            promo:      p.promoId ? promos[p.promoId] : null
        })).join(''));

        grid.find('.product-card').on('click', (e) => {
            const card = e.currentTarget;
            if (card.dataset.disabled) return;
            app.addProduct(card.dataset.id);
        });

        if (window.lucide) lucide.createIcons();
    }

    renderCart(opts) {
        const cart        = opts.cart || [];
        const cartHeaders = opts.cartHeaders || [];
        const totals      = opts.totals     || {};
        const freeLineIds = opts.freeLineIds || new Set();
        const bxgyApplied = opts.bxgyApplied || [];
        const bxgyUpsell  = opts.bxgyUpsell  || [];
        const promos      = opts.promociones || {};

        const wrap        = $('#cartItemsWrap');
        const empty       = $('#cartEmpty');

        // Header del carrito
        this.renderCartHeader(totals);
        this.renderCartFooter(totals);

        // Empty state
        if (!cart.length) {
            wrap.html('');
            wrap.addClass('hidden');
            empty.removeClass('hidden').addClass('flex');
            empty.html(`
                <div class="w-14 h-14 rounded-full bg-[#1a2332] border border-[#374151] flex items-center justify-center mb-2">
                    <i data-lucide="shopping-cart" class="w-6 h-6 text-[#374151]"></i>
                </div>
                <p class="text-[11px] text-[#6B7280]">El ticket esta vacio</p>
                <p class="text-[10px] text-[#4B5563] mt-1">Agrega productos del catalogo</p>
            `);
            this.renderPromoBanners({ bxgyApplied: [] });
            if (window.lucide) lucide.createIcons();
            return;
        }
        empty.addClass('hidden').removeClass('flex');
        wrap.removeClass('hidden');

        wrap.html(cartHeaders.map(it => this.cartItem({
            item:           it,
            children:       cart.filter(c => c.comboId === it.lineId),
            freeLineIds:    freeLineIds,
            bxgyApplied:    bxgyApplied,
            promociones:    promos
        })).join(''));

        wrap.find('.qty-inc').on('click', (e) => {
            e.stopPropagation();
            carrito.changeQty($(e.currentTarget).data('line'), +1);
        });
        wrap.find('.qty-dec').on('click', (e) => {
            e.stopPropagation();
            carrito.changeQty($(e.currentTarget).data('line'), -1);
        });
        wrap.find('.item-remove').on('click', (e) => {
            e.stopPropagation();
            carrito.removeItem($(e.currentTarget).data('line'));
        });

        this.renderPromoBanners({ bxgyApplied: bxgyApplied });
        if (window.lucide) lucide.createIcons();
    }

    renderCartHeader(totals) {
        const t = totals || {};
        const code = (turno && turno.ventaCode) || 'Venta';
        $('#cartHeader').html(`
            <div class="flex items-center justify-between">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-sm font-bold text-white">${this.esc(code)}</h2>
                        <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[rgba(124,58,237,0.15)] text-[#c4b5fd] border border-[rgba(124,58,237,0.35)]">POS</span>
                    </div>
                    <p class="text-[10px] text-[#6B7280] mt-0.5" id="lblHeaderItems">${t.itemsCount || 0} item${(t.itemsCount === 1) ? '' : 's'} &mdash; Venta directa</p>
                </div>
                <button id="btnEliminarTicket" class="${(t.itemsCount > 0) ? '' : 'hidden'} w-7 h-7 rounded-lg bg-[#1a2332] border border-[rgba(234,2,52,0.35)] flex items-center justify-center text-[#EA0234] hover:bg-[#EA0234] hover:text-white transition-colors" title="Eliminar ticket">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <div class="relative mt-2" id="clienteWrapper">
                <div class="flex items-center gap-2 bg-[#1a2332] rounded-lg px-2.5 py-1.5 border border-[#374151]">
                    <i data-lucide="user" class="w-3 h-3 text-[#6B7280] flex-shrink-0"></i>
                    <input type="text" id="inputCliente" placeholder="Buscar cliente por nombre, telefono o correo..." autocomplete="off"
                           class="flex-1 bg-transparent text-[10px] text-white placeholder-[#6B7280] focus:outline-none">
                </div>
            </div>
        `);

        $('#btnEliminarTicket').on('click', async () => {
            if (typeof Swal === 'undefined') {
                if (confirm('Eliminar el ticket actual?')) {
                    carrito.clear();
                }
                return;
            }
            const r = await Swal.fire({
                customClass:    { popup: 'huubie-swal' },
                buttonsStyling: false,
                icon:           'warning',
                title:          'Eliminar el ticket actual?',
                text:           'Se perderan todos los productos agregados al ticket.',
                showCancelButton:  true,
                confirmButtonText: 'Si, eliminar',
                cancelButtonText:  'Cancelar'
            });
            if (r.isConfirmed) {
                carrito.clear();
                app.showSuccess('Ticket eliminado', 'El ticket se borro correctamente.', 1500);
            }
        });

        if (window.lucide) lucide.createIcons();
    }

    renderCartFooter(totals) {
        const t = totals || {};
        const rowDescVisible  = (t.descuento || 0) > 0;
        const rowPromoVisible = (t.descuentoPromo || 0) > 0;
        const firstPromo      = (t.bxgyApplied && t.bxgyApplied[0]) || null;
        const extraPromo      = (t.bxgyApplied && t.bxgyApplied.length > 1) ? ' +' + (t.bxgyApplied.length - 1) : '';

        $('#cartFooter').html(`
            <div class="grid grid-cols-4 gap-1.5">
                <button id="btnDescuento" class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a2332] border border-[#374151] text-[10px] text-[#9CA3AF] hover:text-[#fbbf24]">
                    <i data-lucide="tag" class="w-3 h-3"></i> Descuento
                </button>
                <button id="btnNota" class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a2332] border border-[#374151] text-[10px] text-[#9CA3AF] hover:text-[#76A9FA]">
                    <i data-lucide="pencil" class="w-3 h-3"></i> Nota
                </button>
                <button id="btnImprimir" class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a2332] border border-[#374151] text-[10px] text-[#9CA3AF] hover:text-[#3FC189]">
                    <i data-lucide="printer" class="w-3 h-3"></i> Imprimir
                </button>
                <button id="btnPagar" class="col-span-1 py-1.5 rounded-lg text-xs font-extrabold bg-[#1C64F2] text-white shadow-lg hover:bg-[#1a53d4] active:scale-[0.98] transition-all">
                    PAGAR
                </button>
            </div>
            <p id="lblItemsCount" class="text-[10px] text-[#6B7280] mt-2">${t.itemsCount || 0} item${(t.itemsCount === 1) ? '' : 's'}, ${t.piezas || 0} pza${(t.piezas === 1) ? '' : 's'} vendidas</p>
            <div class="mt-2 space-y-1">
                <div class="flex justify-between text-[11px] text-[#9CA3AF]">
                    <span>Subtotal</span>
                    <span id="lblSubtotal">${this.fmtMoney(t.subtotal || 0)}</span>
                </div>
                <div class="flex justify-between text-[11px] ${rowPromoVisible ? '' : 'hidden'}" id="rowPromo" data-discount-reason="PROMO">
                    <span class="flex items-center gap-1.5 text-[#c4b5fd]">
                        <i data-lucide="tag" class="w-2.5 h-2.5"></i>
                        Promo <span id="lblPromoName" class="text-[#9CA3AF] font-normal">${firstPromo ? this.esc(firstPromo.label + ' ' + firstPromo.promoName + extraPromo) : '-'}</span>
                    </span>
                    <span id="lblPromoAhorro" class="text-[#3FC189] font-bold">-${this.fmtMoney(t.descuentoPromo || 0)}</span>
                </div>
                <div class="flex justify-between text-[11px] text-[#fbbf24] ${rowDescVisible ? '' : 'hidden'}" id="rowDescuento">
                    <span>Descuento</span>
                    <span id="lblDescuento">-${this.fmtMoney(t.descuento || 0)}</span>
                </div>
                <div class="flex justify-between text-base font-extrabold pt-1.5 border-t border-[#374151]">
                    <span>TOTAL</span>
                    <span id="lblTotal" class="text-[#3FC189]">${this.fmtMoney(t.total || 0)}</span>
                </div>
            </div>
        `);

        $('#btnPagar').on('click', () => app.openCobroModal());
        $('#btnDescuento').on('click', () => console.log('[btnDescuento]'));
        $('#btnNota').on('click',      () => console.log('[btnNota]'));
        $('#btnImprimir').on('click',  () => console.log('[btnImprimir]'));

        if (window.lucide) lucide.createIcons();
    }

    renderPromoBanners(opts) {
        const wrap = $('#promoBannersWrap');
        if (!wrap.length) return;
        const applied = opts.bxgyApplied || [];

        if (!applied.length) {
            wrap.addClass('hidden').html('');
            return;
        }
        wrap.removeClass('hidden');

        wrap.html(applied.map(a => {
            const isPink   = a.badgeClass === 'badge-2x1';
            const freeName = a.freeItems.map(f => f.name).join(', ');
            return `
                <div class="savings-banner ${isPink ? 'pink' : ''}" data-promo-id="${a.promoId}" data-promo-type="BXGY">
                    <span class="badge-promo-base ${a.badgeClass} flex-shrink-0">${this.esc(a.label)}</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold text-white truncate">${this.esc(a.promoName)}</p>
                        <p class="text-[9px] text-[#9CA3AF] truncate">${a.setsApplied} set${a.setsApplied === 1 ? '' : 's'} &middot; Gratis: ${this.esc(freeName)}</p>
                    </div>
                    <p class="text-[11px] font-bold text-[#3FC189] flex-shrink-0">-${this.fmtMoneyShort(a.amountSaved)}</p>
                </div>
            `;
        }).join(''));
    }

    renderCobroModal(opts) {
        if ($('#modalCobro').length) return;
        const html = `
            <div id="modalCobro" class="modal-cobro hidden">
                <div class="modal-backdrop" id="modalCobroBackdrop"></div>
                <div class="relative bg-[#1F2A37] border border-[#374151] rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">
                    <div class="px-5 py-4 border-b border-[#374151] flex items-center justify-between flex-shrink-0">
                        <div>
                            <h3 class="text-base font-bold text-white">Cobro de venta</h3>
                            <p class="text-[10px] text-[#9CA3AF]" id="modalCliente">Publico en general</p>
                        </div>
                        <button id="btnCloseCobro" class="text-[#9CA3AF] hover:text-white">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                        <div class="grid grid-cols-3 gap-3">
                            <div class="bg-[#1a2332] border border-[#374151] rounded-lg px-3 py-2">
                                <p class="text-[9px] uppercase tracking-wider text-[#6B7280]">Subtotal</p>
                                <p class="text-sm font-bold text-white" id="modalSubtotal">$0.00</p>
                            </div>
                            <div class="bg-[#1a2332] border border-[#374151] rounded-lg px-3 py-2">
                                <p class="text-[9px] uppercase tracking-wider text-[#6B7280]">Descuento</p>
                                <p class="text-sm font-bold text-[#fbbf24]" id="lblModalDescuento">-$0.00</p>
                            </div>
                            <div class="bg-[#1a2332] border border-[rgba(63,193,137,0.4)] rounded-lg px-3 py-2">
                                <p class="text-[9px] uppercase tracking-wider text-[#6B7280]">Total a pagar</p>
                                <p class="text-sm font-bold text-[#3FC189]" id="modalTotalPagar">$0.00</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <p class="text-[10px] uppercase tracking-wider text-[#6B7280] font-bold">Conceptos de pago</p>
                            <button id="btnToggleAllMethods" class="text-[10px] text-[#76A9FA] hover:text-white">Mostrar todos</button>
                        </div>

                        <div class="bg-[#0E1521] border border-[#374151] rounded-lg overflow-hidden divide-y divide-[#374151]" id="methodsGrid"></div>

                        <div class="bg-[#1a2332] border border-[#374151] rounded-lg px-3 py-2 space-y-1">
                            <div class="flex justify-between text-[11px] text-[#9CA3AF]">
                                <span>Total pagado</span>
                                <span id="lblTotalPagado">$0.00</span>
                            </div>
                            <div class="flex justify-between text-[11px] text-[#fbbf24] hidden" id="rowRestante">
                                <span>Restante</span>
                                <span id="lblRestante">$0.00</span>
                            </div>
                            <div class="flex justify-between text-[11px] text-[#3FC189] hidden" id="rowCambio">
                                <span>Cambio</span>
                                <span id="lblCambio">$0.00</span>
                            </div>
                        </div>
                    </div>
                    <div class="px-5 py-4 border-t border-[#374151] flex-shrink-0 flex gap-2">
                        <button id="btnCancelCobro" class="flex-1 py-2 rounded-lg text-xs font-semibold text-[#9CA3AF] border border-[#374151] hover:text-white">Cancelar</button>
                        <button id="btnConfirmar" class="flex-1 py-2 rounded-lg text-xs font-extrabold bg-[#3FC189] text-white shadow-lg opacity-50 cursor-not-allowed">Confirmar pago</button>
                    </div>
                </div>
            </div>
        `;
        $('body').append(html);

        // Estado del modal
        this._cobroState = {
            metodosPago: (opts.metodosPago || SAMPLE_POSMAIN_METODOS_PAGO).map(m => Object.assign({}, m)),
            showAll:     false,
            total:       0
        };

        $('#btnCloseCobro').on('click', () => this.closeCobroModal());
        $('#btnCancelCobro').on('click', () => this.closeCobroModal());
        $('#modalCobroBackdrop').on('click', () => this.closeCobroModal());
        $('#btnToggleAllMethods').on('click', () => this.toggleAllMethods());
        $('#btnConfirmar').on('click', () => this.confirmPayment());

        if (window.lucide) lucide.createIcons();
    }

    openCobroModal(opts) {
        const totals          = opts.totals || {};
        const selectedCliente = opts.selectedCliente;
        const state           = this._cobroState;

        state.total = Number(totals.total) || 0;

        const defaultActiveIds = ['efe', 'tdc', 'tdd', 'trf'];
        state.metodosPago.forEach(m => {
            m.active = defaultActiveIds.indexOf(m.id) !== -1;
            m.amount = 0;
        });
        state.showAll = false;

        $('#btnToggleAllMethods').text('Mostrar todos');

        // Etiquetas
        $('#modalSubtotal').text(this.fmtMoney(totals.subtotal || 0));
        $('#lblModalDescuento').text('-' + this.fmtMoney((totals.descuento || 0) + (totals.descuentoPromo || 0)));
        $('#modalTotalPagar').text(this.fmtMoney(state.total));

        // Cliente
        if (selectedCliente) {
            const meta = [selectedCliente.phone, selectedCliente.email].filter(Boolean).join(' · ');
            $('#modalCliente').text(meta ? `${selectedCliente.name} (${meta})` : selectedCliente.name);
        } else {
            const manual = ($('#inputCliente').val() || '').trim();
            $('#modalCliente').text(manual || 'Publico en general');
        }

        this.renderMethods();
        this.calcCobroTotals();
        $('#modalCobro').removeClass('hidden');
    }

    closeCobroModal() {
        $('#modalCobro').addClass('hidden');
    }

    toggleAllMethods() {
        const state = this._cobroState;
        state.showAll = !state.showAll;
        $('#btnToggleAllMethods').text(state.showAll ? 'Mostrar activos' : 'Mostrar todos');
        this.renderMethods();
    }

    renderMethods() {
        const state   = this._cobroState;
        const cont    = $('#methodsGrid');
        const visible = state.showAll ? state.metodosPago : state.metodosPago.filter(m => m.active);

        if (!visible.length) {
            cont.html(`
                <div class="px-2.5 py-4 text-center text-[10px] text-[#6B7280]">
                    Sin conceptos de pago activos
                </div>
            `);
            return;
        }

        cont.html(visible.map(m => `
            <div class="grid grid-cols-[80px_1fr_130px] items-center transition-colors ${m.active ? 'bg-[rgba(28,100,242,0.04)]' : 'hover:bg-[#1a2332]'}">
                <div class="px-2.5 py-2 flex items-center gap-1.5">
                    <input type="checkbox" ${m.active ? 'checked' : ''} class="method-toggle w-3.5 h-3.5 rounded border-[#374151] bg-[#1a2332] accent-[#1C64F2]" data-method-id="${m.id}">
                    <span class="text-[10px] font-bold ${m.active ? 'text-[#76A9FA]' : 'text-[#6B7280]'}">${this.esc(m.clave)}</span>
                </div>
                <div class="px-2.5 py-2 text-[11px] ${m.active ? 'text-white' : 'text-[#9CA3AF]'}">${this.esc(m.name)}</div>
                <div class="px-2.5 py-2">
                    ${m.active
                        ? `<div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[#6B7280] text-[10px] font-bold">$</span>
                                <input type="number" step="0.01" min="0" value="${m.amount || ''}" placeholder="0.00"
                                       class="method-amount w-full bg-[#141d2b] border border-[#374151] rounded pl-5 pr-2 py-1 text-[11px] text-white text-right font-bold focus:outline-none focus:border-[#1C64F2]"
                                       data-method-id="${m.id}">
                           </div>`
                        : `<span class="block text-[10px] text-[#4B5563] text-right">$0.00</span>`}
                </div>
            </div>
        `).join(''));

        cont.find('.method-toggle').on('change', (e) => {
            const id = $(e.currentTarget).data('method-id');
            const m  = state.metodosPago.find(x => x.id === id);
            if (!m) return;
            m.active = !m.active;
            if (!m.active) m.amount = 0;
            this.renderMethods();
            this.calcCobroTotals();
        });
        cont.find('.method-amount').on('input', (e) => {
            const id = $(e.currentTarget).data('method-id');
            const m  = state.metodosPago.find(x => x.id === id);
            if (!m) return;
            m.amount = parseFloat($(e.currentTarget).val()) || 0;
            this.calcCobroTotals();
        });
    }

    calcCobroTotals() {
        const state       = this._cobroState;
        const totalAPagar = state.total;
        const totalPagado = state.metodosPago.reduce((s, m) => s + (m.active ? (parseFloat(m.amount) || 0) : 0), 0);
        const restante    = totalAPagar - totalPagado;

        $('#lblTotalPagado').text(this.fmtMoney(totalPagado));

        if (restante > 0.001) {
            $('#rowRestante').removeClass('hidden');
            $('#rowCambio').addClass('hidden');
            $('#lblRestante').text(this.fmtMoney(restante));
            $('#btnConfirmar').addClass('opacity-50 cursor-not-allowed');
        } else {
            $('#rowRestante').addClass('hidden');
            $('#rowCambio').removeClass('hidden');
            $('#lblCambio').text(this.fmtMoney(Math.abs(restante)));
            $('#btnConfirmar').removeClass('opacity-50 cursor-not-allowed');
        }
    }

    confirmPayment() {
        const state       = this._cobroState;
        const activos     = state.metodosPago.filter(m => m.active && m.amount > 0);
        const totalPagado = activos.reduce((s, m) => s + m.amount, 0);

        if (totalPagado < state.total) {
            app.showWarn('Pago insuficiente', `Falta por cubrir ${this.fmtMoney(state.total - totalPagado)} para completar la venta.`);
            return;
        }
        if (!activos.length) {
            app.showWarn('Sin conceptos de pago', 'Selecciona al menos un concepto de pago e ingresa el importe.');
            return;
        }
        const cambio = totalPagado - state.total;
        const resumen = `
            <div class="text-left text-xs space-y-1 mt-2">
                ${activos.map(m => `<div class="flex justify-between gap-4"><span class="text-[#9CA3AF]"><b>${this.esc(m.clave)}</b> &mdash; ${this.esc(m.name)}</span><span class="text-white font-bold">${this.fmtMoney(m.amount)}</span></div>`).join('')}
                <div class="flex justify-between gap-4 pt-2 mt-2 border-t border-[#374151]">
                    <span class="text-[#9CA3AF]">Total pagado</span>
                    <span class="text-[#3FC189] font-bold">${this.fmtMoney(totalPagado)}</span>
                </div>
                ${cambio > 0 ? `<div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Cambio</span><span class="text-[#3FC189] font-bold">${this.fmtMoney(cambio)}</span></div>` : ''}
            </div>
        `;
        this.closeCobroModal();
        carrito.clear();
        app.showSuccess('Venta cobrada', resumen, 2500);
    }

    // -- Helpers de instancia --

    esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    fmtMoney(n) {
        return _fmtMoney(n);
    }

    fmtMoneyShort(n) {
        return _fmtMoneyShort(n);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Componentes locales (PORTADOS 1:1 desde el pivote pos-entradas.js)
    //  viewHeader, viewFooter, tabsBar, kpisRow
    //  NO viven en Templates (coffeeSoft.js); por eso viven aqui.
    // ──────────────────────────────────────────────────────────────────

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl: 'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-accent-purple,#7C3AED)] bg-[var(--cs-accent-purple,#7C3AED)]/15 text-white',
                sep:      'text-[var(--cs-border,#374151)]',
                backBtn:  'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-accent-purple,#7C3AED)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-accent-purple,#7C3AED)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onBack:   null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const state = {};
        (opts.json.toggles || []).forEach(g => { state[g.key] = g.value; });

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toggleGroup = (g) => {
            const buttons = (g.options || []).map(op => {
                const active = state[g.key] === op.value;
                return `<button type="button"
                                data-toggle-key="${esc(g.key)}"
                                data-toggle-value="${esc(op.value)}"
                                class="${active ? opts.classes.btnActive : opts.classes.btn}">${esc(op.label)}</button>`;
            }).join('');
            return `
                <div class="flex items-center gap-2">
                    <span class="${opts.classes.groupLbl}">${esc(g.label)}</span>
                    ${buttons}
                </div>
            `;
        };

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-4">
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-toggle-key');
            const val  = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive  = $(this).attr('data-toggle-value') === val;
                this.className  = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger:  'var(--cs-danger,#E02424)',
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                item:   'flex items-center gap-1'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.tones   = Object.assign({}, defaults.tones,   o.tones   || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneColor = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    tabsBar(options) {
        const defaults = {
            parent: 'root',
            id:     'tabsBar',
            class:  'flex items-center gap-1 border-b border-transparent',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer'
            },
            onChange: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html((opts.json || []).map(tab => `
            <button type="button"
                    data-tab-id="${esc(tab.id)}"
                    class="${tab.active ? opts.classes.tabActive : opts.classes.tab}">
                ${esc(tab.label)}
            </button>
        `).join(''));

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-tab-id]', (e) => {
            const id = $(e.currentTarget).attr('data-tab-id');
            wrap.find('[data-tab-id]').each(function () {
                const isActive = $(this).attr('data-tab-id') === id;
                this.className = isActive ? opts.classes.tabActive : opts.classes.tab;
            });
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-4 gap-3',
            json:   [],
            labels: { empty: 'Sin indicadores' },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)]',
            valueClass: 'cs-kpi-value text-sm font-bold',
            onClick:    () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.tones  = Object.assign({}, defaults.tones,  o.tones  || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const kpiCard = (kpi, idx) => {
            const cardId = kpi.id || `${opts.id}_${idx}`;
            return `
                <div id="${cardId}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                    <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                    <p class="${opts.valueClass} ${toneClass(kpi.tone)}" id="${cardId}_value">${esc(kpi.value)}</p>
                </div>
            `;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`
                <p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">
                    ${esc(opts.labels.empty)}
                </p>
            `);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));
        $(`#${opts.parent}`).html(grid);

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            const kpi = opts.json[idx];
            opts.onClick(kpi, idx);
        });
    }

    // ──────────────────────────────────────────────────────────────────
    //  Componentes locales especificos del POS
    //  productCard, cartItem, badgeBXGY
    // ──────────────────────────────────────────────────────────────────

    badgeBXGY(promo) {
        if (!promo) return '';
        return `<span class="badge-promo-base ${promo.badgeClass}" title="${this.esc(promo.name)}">${this.esc(promo.label)}</span>`;
    }

    productCard(opts) {
        const p     = opts.producto;
        const promo = opts.promo;
        if (!p) return '';

        const st        = _productStatus(p);
        const isOut     = p.stock <= 0;
        const isCombo   = p.isCombo === 1;
        const isPromo   = !!promo && !isCombo;
        const opacity   = isOut ? 'opacity-50' : '';
        const cursor    = isOut ? 'cursor-not-allowed' : 'cursor-pointer';
        const comboCls  = isCombo ? 'is-combo' : (isPromo ? 'is-promo' : '');
        const headerBg  = isCombo
            ? 'bg-gradient-to-br from-[rgba(124,58,237,0.18)] to-[rgba(124,58,237,0.05)]'
            : isPromo
                ? 'bg-gradient-to-br from-[rgba(124,58,237,0.10)] to-[rgba(28,100,242,0.05)]'
                : 'bg-[#141d2b]';

        const comboTip = isCombo
            ? `title="Incluye: ${(p.components || []).map(comp => {
                const cp = productos.getProductoById(comp.productId);
                return cp ? `${comp.quantity}x ${cp.name}` : '';
            }).filter(Boolean).join(', ')}"`
            : (isPromo ? `title="${this.esc(promo.name)} &mdash; ${this.esc(promo.tagline)}"` : '');

        const promoData  = isPromo ? `data-promo-id="${promo.id}" data-promo-type="${p.promoType}"` : '';
        const promoBadge = isPromo
            ? `<span class="absolute top-1 left-1 badge-promo-base ${promo.badgeClass}" title="${this.esc(promo.name)}">${this.esc(promo.label)}</span>`
            : '';

        const iconColor = isCombo || isPromo ? 'text-[#c4b5fd]' : 'text-[#9CA3AF]';
        const priceColor= isCombo ? 'text-[#c4b5fd]' : 'text-[#76A9FA]';
        const addBg     = isCombo ? 'bg-[#7C3AED] hover:bg-[#6D28D9]' : 'bg-[#1C64F2] hover:bg-[#1A56DB]';

        return `
            <div class="product-card ${comboCls} bg-[#1F2A37] rounded-lg overflow-hidden ${opacity} ${cursor}"
                 data-id="${p.id}" ${isOut ? 'data-disabled="1"' : ''} ${promoData} ${comboTip}>
                <div class="h-16 flex items-center justify-center relative ${headerBg}">
                    <i data-lucide="${p.icon}" class="w-6 h-6 ${iconColor}"></i>
                    ${isCombo
                        ? `<span class="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1 rounded text-[7px] font-bold bg-[rgba(124,58,237,0.25)] text-[#c4b5fd] border border-[rgba(124,58,237,0.5)]"><i data-lucide="gift" class="w-2 h-2"></i>COMBO</span>`
                        : isPromo
                            ? promoBadge
                            : `<span class="absolute top-1 left-1 px-1 rounded text-[7px] font-bold" style="background:${st.bg};color:${st.fg}">${this.esc(st.label)}</span>`}
                    ${(p.stock > 0 && !isCombo)
                        ? `<span class="absolute top-1 right-1 w-4 h-4 rounded-full bg-[rgba(124,58,237,0.25)] text-[9px] font-bold flex items-center justify-center text-[#c4b5fd]">${p.stock}</span>`
                        : ''}
                    ${isCombo ? `<span class="absolute top-1 right-1 px-1 rounded text-[8px] font-bold bg-[rgba(124,58,237,0.25)] text-[#c4b5fd]">${(p.components || []).length} prod</span>` : ''}
                </div>
                <div class="p-2.5">
                    <p class="text-[10px] font-semibold truncate leading-tight text-white">${this.esc(p.name)}</p>
                    <div class="flex items-center justify-between mt-1">
                        <p class="text-xs font-bold ${priceColor}">${this.fmtMoneyShort(p.price)}</p>
                        <button class="btn-add w-5 h-5 rounded ${addBg} flex items-center justify-center ${isOut ? 'pointer-events-none opacity-40' : ''}" title="Agregar al ticket">
                            <i data-lucide="plus" class="w-3 h-3 text-white"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    cartItem(opts) {
        const it             = opts.item;
        const childrenArr    = opts.children || [];
        const freeLineIds    = opts.freeLineIds || new Set();
        const bxgyApplied    = opts.bxgyApplied || [];
        const promos         = opts.promociones || {};

        const p              = productos.getProductoById(it.id);
        if (!p) return '';

        const discountPct  = it.discount || 0;
        const importeBruto = p.price * it.qty;
        const importe      = importeBruto * (1 - discountPct / 100);
        const hasDiscount  = discountPct > 0;
        const isCombo      = p.isCombo === 1;

        // BXGY: cuantas unidades de esta linea son gratis
        let promoFreeCount = 0;
        if (p.promoId && freeLineIds.has(it.lineId)) {
            const applied = bxgyApplied.find(a => a.promoId === p.promoId);
            if (applied) {
                promoFreeCount = applied.freeItems.filter(f => f.name === p.name).length;
            }
        }
        const hasPromoFree    = promoFreeCount > 0;
        const promoDef        = p.promoId ? promos[p.promoId] : null;
        const promoFreeAmount = hasPromoFree ? promoFreeCount * p.price : 0;

        const childrenHtml = isCombo
            ? childrenArr.map(c => {
                const cp = productos.getProductoById(c.id);
                if (!cp) return '';
                return `
                    <div class="flex items-center gap-2 pl-3 pr-1 py-1 text-[10px] text-[#9CA3AF]">
                        <span class="text-[#7C3AED]">&#9492;</span>
                        <i data-lucide="${cp.icon}" class="w-3 h-3 text-[#6B7280]"></i>
                        <span class="flex-1 truncate">${this.esc(cp.name)}</span>
                        <span class="text-[#6B7280]">x${c.qty}</span>
                        <span class="text-[9px] text-[#4B5563] italic">incluido</span>
                    </div>
                `;
            }).join('')
            : '';

        const comboBadge = isCombo
            ? `<span class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-[rgba(124,58,237,0.18)] text-[#c4b5fd] border border-[rgba(124,58,237,0.35)] ml-1"><i data-lucide="gift" class="w-2 h-2"></i>COMBO</span>`
            : '';

        const promoBxgyBadge = (promoDef && !isCombo)
            ? `<span class="badge-promo-base ${promoDef.badgeClass} ml-1" title="${this.esc(promoDef.name)}">${this.esc(promoDef.label)}</span>`
            : '';

        const freeBadge = hasPromoFree
            ? `<span class="badge-promo-base badge-free ml-1" title="Regalo de promo">${promoFreeCount} GRATIS</span>`
            : '';

        const promoFreeClass = hasPromoFree ? 'is-promo-free' : '';
        const borderLeft     = hasPromoFree ? ''
            : hasDiscount ? 'border-l-2 border-l-[#fbbf24]'
            : isCombo     ? 'border-l-2 border-l-[#7C3AED]'
            : '';

        const importeFinal = importe - promoFreeAmount;

        const dataPromo = promoDef ? `data-promo-id="${promoDef.id}" data-promo-type="BXGY"` : '';

        return `
            <div class="cart-item ${promoFreeClass} bg-[#1a2332] rounded-lg p-2.5 border border-[rgba(55,65,81,0.5)] ${borderLeft}" ${dataPromo}>
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${isCombo ? 'bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.35)]' : hasPromoFree ? 'bg-[rgba(63,193,137,0.12)] border border-[rgba(63,193,137,0.35)]' : 'bg-[#141d2b] border border-[#374151]'}">
                        <i data-lucide="${p.icon}" class="w-4 h-4 ${isCombo ? 'text-[#c4b5fd]' : hasPromoFree ? 'text-[#3FC189]' : 'text-[#9CA3AF]'}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-semibold truncate text-white">${this.esc(p.name)}${comboBadge}${promoBxgyBadge}${freeBadge}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <div class="flex items-center gap-0.5">
                                <button class="qty-dec w-5 h-5 rounded bg-[#374151] flex items-center justify-center text-[10px] font-bold hover:bg-[#4B5563] text-white" data-line="${it.lineId}">-</button>
                                <span class="w-6 text-center text-[10px] font-bold text-white">${it.qty}</span>
                                <button class="qty-inc w-5 h-5 rounded bg-[#374151] flex items-center justify-center text-[10px] font-bold hover:bg-[#4B5563] text-white" data-line="${it.lineId}">+</button>
                            </div>
                            <span class="text-[9px] text-[#6B7280]">x ${this.fmtMoneyShort(p.price)}</span>
                            ${hasDiscount ? `<span class="text-[9px] font-bold text-[#fbbf24]">-${discountPct}%</span>` : ''}
                            ${hasPromoFree ? `<span class="text-[9px] font-bold text-[#3FC189]">-${this.fmtMoneyShort(promoFreeAmount)}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-right flex flex-col items-end gap-1">
                        <div class="flex flex-col items-end leading-tight">
                            ${(hasDiscount || hasPromoFree) ? `<p class="text-[9px] text-[#6B7280] line-through">${this.fmtMoneyShort(importeBruto)}</p>` : ''}
                            <p class="text-xs font-bold ${hasPromoFree ? 'text-[#3FC189]' : 'text-white'}">${this.fmtMoneyShort(importeFinal)}</p>
                        </div>
                        <button class="item-remove w-5 h-5 rounded bg-[rgba(234,2,52,0.12)] border border-[rgba(234,2,52,0.3)] flex items-center justify-center text-[#EA0234] hover:bg-[rgba(234,2,52,0.25)]" data-line="${it.lineId}" title="Quitar">
                            <i data-lucide="x" class="w-2.5 h-2.5"></i>
                        </button>
                    </div>
                </div>
                ${childrenHtml ? `<div class="mt-1.5 pt-1.5 border-t border-dashed border-[rgba(124,58,237,0.25)]">${childrenHtml}</div>` : ''}
            </div>
        `;
    }
}
