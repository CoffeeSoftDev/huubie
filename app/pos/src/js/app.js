let api = 'ctrl/ctrl-pos.php';
let app, data;

$(async () => {
    data = await useFetch({ url: api, data: { opc: 'init' } });

    app = new App(api, 'root');
    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME    = 'POS';
        this.products        = data.products  || [];
        this.turno           = data.turno     || null;
        this.sucursal        = data.sucursal  || '';
        this.vendedor        = data.vendedor  || '';
        this.folioNum        = data.folio     || 1;
        this.categories      = ['Todos', ...new Set(this.products.map(p => p.category))];
        this.cart            = [];
        this.activeCategory  = 'Todos';
        this.searchQuery     = '';
        this.accountDiscount = null;
        this.selectedClient  = null;
        this.ticketNote      = null;
    }

    render() {
        this.layout();
        this.renderInfoHeader();
        this.renderSearchBar();
        this.renderSalesInfo();
        this.renderSalesActions();
        this.renderCart();
        this.renderProducts();
    }

    layout() {
        const name = this.PROJECT_NAME;

        const catalogPanel = {
            type:  'div',
            id:    'catalogPanel',
            class: 'flex flex-col flex-1 min-w-0 max-w-[60%]',
            children: [
                { id: 'infoHeader',  class: 'flex-shrink-0' },
                { id: 'searchBar',   class: 'flex-shrink-0' },
                { id: 'productGrid', class: 'flex-1 overflow-y-auto px-4 pb-3 scrollbar-thin' }
            ]
        };

        const salesPanel = {
            type:  'div',
            id:    'salesPanel',
            class: 'flex flex-col w-[40%] bg-[#141d2b] border-l border-[#374151]',
            children: [
                { id: 'salesInfo',         class: 'flex-shrink-0' },
                { id: 'productsContainer', class: 'flex-1 overflow-y-auto scrollbar-thin relative' },
                { id: 'salesActions',      class: 'flex-shrink-0' }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        name,
                class:     'mt-14 h-[calc(100vh-3.5rem)] flex overflow-hidden',
                container: [catalogPanel, salesPanel]
            }
        });
    }

    // ── HU-01: Header turno ───────────────────────────────────────────────────
    renderInfoHeader() {
        const turnoActive = !!this.turno;
        const turnoLabel  = this.turno?.nombre || 'SIN TURNO';
        const sucursal    = this.sucursal || '—';
        const vendedor    = this.vendedor || '—';
        const ventas      = this.turno?.ventas  || 0;
        const ordenes     = this.turno?.ordenes || 0;

        $('#infoHeader').html(`
            <div class="flex items-center justify-between px-4 py-2.5 bg-[#0E1521] border-b border-[#374151]">
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-1.5 px-2.5 py-1 bg-[rgba(63,193,137,0.12)] border border-[rgba(63,193,137,0.3)] rounded-lg">
                        <div class="w-1.5 h-1.5 rounded-full bg-[#3FC189] ${turnoActive ? 'pulse-dot' : ''}"></div>
                        <span class="text-[10px] font-semibold text-[#3FC189]">${turnoLabel.toUpperCase()}</span>
                    </div>
                    <span class="text-[10px] text-[#6B7280]">${sucursal} — ${vendedor}</span>
                </div>
                <div class="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
                    <span>Ventas: <strong class="text-[#3FC189]">$${Number(ventas).toLocaleString('es-MX')}</strong></span>
                    <span class="text-[#374151]">|</span>
                    <span>Ordenes: <strong class="text-white">${ordenes}</strong></span>
                    <span class="text-[#374151]">|</span>
                    <button id="btnCierreDay" class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.3)] text-[#c4b5fd] hover:bg-[rgba(124,58,237,0.25)] hover:text-white transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <span class="font-semibold">Cierre del dia</span>
                    </button>
                </div>
            </div>
        `);

        $('#btnCierreDay').on('click', () => this.openCierreModal());
    }

    // ── HU-01: Busqueda + categorias ─────────────────────────────────────────
    renderSearchBar() {
        $('#searchBar').html(`
            <div class="px-4 pt-3 pb-2 space-y-2">
                <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input id="inputSearch" type="text" placeholder="Buscar producto o escanear..."
                           class="pl-9 pr-4 py-2 text-xs w-full bg-[#1a2332] border border-[#374151] text-white rounded-[8px] focus:outline-none focus:border-[#7C3AED] transition-colors placeholder-[#6B7280]">
                </div>
                <div id="catContainer" class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin"></div>
            </div>
        `);

        $('#inputSearch').on('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderProducts();
        });

        this.renderCategories();
    }

    renderCategories() {
        const html = this.categories.map(cat => {
            const isActive = cat === this.activeCategory;
            const base     = 'flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors';
            const style    = isActive
                ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-[0_2px_8px_rgba(124,58,237,0.3)]'
                : 'bg-[#1a2332] text-[#9CA3AF] border-[#374151] hover:border-[#7C3AED] hover:text-white';
            return `<button class="${base} ${style}" data-cat="${cat}">${cat}</button>`;
        }).join('');

        $('#catContainer').html(html);
        $('#catContainer button').on('click', (e) => {
            this.activeCategory = $(e.currentTarget).data('cat');
            this.renderCategories();
            this.renderProducts();
        });
    }

    // ── HU-01: Grid de productos ──────────────────────────────────────────────
    renderProducts() {
        const q        = this.searchQuery.trim().toLowerCase();
        const filtered = this.products.filter(p => {
            const matchCat    = this.activeCategory === 'Todos' || p.category === this.activeCategory;
            const matchSearch = !q || p.name.toLowerCase().includes(q);
            return matchCat && matchSearch;
        });

        if (filtered.length === 0) {
            $('#productGrid').html(`
                <div class="flex flex-col items-center justify-center py-10 text-center">
                    <svg class="w-10 h-10 text-[#374151] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <p class="text-[11px] text-[#6B7280]">Sin productos para esta busqueda</p>
                </div>
            `);
            return;
        }

        const html = filtered.map(p => this._productCardHtml(p)).join('');
        $('#productGrid').html(`<div class="grid grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">${html}</div>`);

        $('#productGrid .product-card').on('click', (e) => {
            const id = $(e.currentTarget).data('id');
            const p  = this.products.find(x => x.id == id);
            if (!p || p.stock <= 0) return;
            this.addToCart(id);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    _productCardHtml(p) {
        const st      = this._productStatus(p);
        const isOut   = p.stock <= 0;
        const opacity = isOut ? 'opacity-50' : '';
        const cursor  = isOut ? 'cursor-not-allowed' : 'cursor-pointer';
        const icon    = p.icon || 'package';

        return `
            <div class="product-card bg-[#1F2A37] rounded-lg overflow-hidden border border-[rgba(55,65,81,0.5)] transition-all hover:border-[#7C3AED] hover:shadow-[0_8px_24px_rgba(124,58,237,0.12)] ${opacity} ${cursor}" data-id="${p.id}">
                <div class="h-16 flex items-center justify-center relative bg-[#141d2b]">
                    <i data-lucide="${icon}" class="w-6 h-6 text-[#9CA3AF]"></i>
                    <span class="absolute top-1 left-1 px-1 rounded text-[7px] font-bold" style="background:${st.bg};color:${st.fg}">${st.label}</span>
                    ${p.stock > 0 ? `<span class="absolute top-1 right-1 w-4 h-4 rounded-full bg-[rgba(124,58,237,0.25)] text-[9px] font-bold flex items-center justify-center text-[#c4b5fd]">${p.stock}</span>` : ''}
                </div>
                <div class="p-2.5">
                    <p class="text-[10px] font-semibold truncate leading-tight text-white">${p.name}</p>
                    <div class="flex items-center justify-between mt-1">
                        <p class="text-xs font-bold text-[#76A9FA]">$${Number(p.price).toLocaleString('es-MX')}</p>
                        <button class="btn-add w-5 h-5 rounded bg-[#1C64F2] hover:bg-[#1A56DB] flex items-center justify-center ${isOut ? 'pointer-events-none opacity-40' : ''}" data-id="${p.id}">
                            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    _productStatus(p) {
        if (p.stock <= 0) return { label: 'Agotado',    fg: '#EA0234', bg: 'rgba(234,2,52,0.15)' };
        if (p.stock <= 3) return { label: 'Bajo stock', fg: '#FBBF24', bg: 'rgba(251,191,36,0.15)' };
        return               { label: 'Disponible',  fg: '#3FC189', bg: 'rgba(63,193,137,0.15)' };
    }

    // ── HU-02: Header del ticket + selector cliente ───────────────────────────
    renderSalesInfo() {
        $('#salesInfo').html(`
            <div class="px-4 py-3 border-b border-[#374151] bg-[#141d2b]">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm font-bold text-white">Venta #${this.folioNum}</h2>
                            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[rgba(124,58,237,0.15)] text-[#c4b5fd] border border-[rgba(124,58,237,0.35)]">POS</span>
                        </div>
                        <p class="text-[10px] text-[#6B7280] mt-0.5" id="lblHeaderItems">0 items — Venta directa</p>
                    </div>
                    <button id="btnEliminarTicket" class="hidden w-7 h-7 rounded-lg bg-[#1a2332] border border-[rgba(234,2,52,0.35)] flex items-center justify-center text-[#EA0234] hover:bg-[#EA0234] hover:text-white transition-colors" title="Eliminar ticket">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>

                <div class="relative mt-2">
                    <div class="flex gap-2">
                        <div class="flex-1 relative">
                            <div id="clienteInputWrap" class="flex items-center gap-2 bg-[#1a2332] rounded-lg px-2.5 py-1.5 border border-[#374151] focus-within:border-[#7C3AED] transition-colors">
                                <svg class="w-3 h-3 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                <input type="text" id="inputCliente" placeholder="Buscar cliente por nombre, telefono o correo..." autocomplete="off"
                                       class="flex-1 bg-transparent text-[10px] text-white placeholder-[#6B7280] focus:outline-none">
                                <button id="btnClearCliente" type="button" class="hidden text-[#6B7280] hover:text-[#EA0234]">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>
                            <div id="clienteDropdown" class="hidden absolute top-full left-0 right-0 mt-1 bg-[#1F2A37] border border-[#374151] rounded-lg shadow-2xl z-20 max-h-[180px] overflow-y-auto scrollbar-thin"></div>
                        </div>
                        <button id="btnAgregarCliente" type="button" class="px-2 bg-[#1a2332] border border-[#374151] rounded-lg text-[#9CA3AF] hover:text-[#1C64F2] hover:border-[rgba(28,100,242,0.4)] text-[10px] font-semibold transition-colors flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                            Agregar
                        </button>
                    </div>
                    <div id="clienteSelected" class="hidden mt-1.5"></div>
                </div>
            </div>
        `);

        $('#btnEliminarTicket').on('click',   () => this.confirmEliminarTicket());
        $('#btnAgregarCliente').on('click',   () => this.openNewClientModal());
        $('#inputCliente').on('input',        (e) => this.searchClients(e.target.value));
        $('#btnClearCliente').on('click',     () => this.clearCliente());
    }

    // ── HU-02: Carrito ────────────────────────────────────────────────────────
    addToCart(id) {
        const existing = this.cart.find(it => it.id == id);
        if (existing) {
            existing.qty += 1;
        } else {
            this.cart.push({ id, qty: 1, discount: 0 });
        }
        this.renderCart();
        this.updateTotals();
    }

    changeQty(id, delta) {
        const item = this.cart.find(it => it.id == id);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) this.cart.splice(this.cart.indexOf(item), 1);
        this.renderCart();
        this.updateTotals();
    }

    removeFromCart(id) {
        const idx = this.cart.findIndex(it => it.id == id);
        if (idx !== -1) this.cart.splice(idx, 1);
        this.renderCart();
        this.updateTotals();
    }

    renderCart() {
        const hasItems = this.cart.length > 0;

        if (!hasItems) {
            $('#productsContainer').html(`
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <div class="w-14 h-14 rounded-full bg-[#1a2332] border border-[#374151] flex items-center justify-center mb-2">
                        <svg class="w-6 h-6 text-[#374151]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    </div>
                    <p class="text-[11px] text-[#6B7280]">El ticket esta vacio</p>
                    <p class="text-[10px] text-[#4B5563] mt-1">Agrega productos del catalogo</p>
                </div>
            `);
            $('#btnEliminarTicket').addClass('hidden');
            $('#lblHeaderItems').text('0 items — Venta directa');
            return;
        }

        const html = this.cart.map(item => {
            const p = this.products.find(x => x.id == item.id);
            if (!p) return '';
            const lineTotal = p.price * item.qty;
            const icon      = p.icon || 'package';
            return `
                <div class="cart-item flex items-center gap-2 p-2 rounded-lg bg-[#1a2332] border border-[#374151]" style="animation:slideIn .15s ease">
                    <div class="w-8 h-8 rounded-lg bg-[#141d2b] flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${icon}" class="w-4 h-4 text-[#9CA3AF]"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-semibold text-white truncate">${p.name}</p>
                        <p class="text-[10px] text-[#6B7280]">$${Number(p.price).toLocaleString('es-MX')} c/u</p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button class="btn-minus w-5 h-5 rounded bg-[#374151] hover:bg-[#4B5563] flex items-center justify-center text-white" data-id="${item.id}">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg>
                        </button>
                        <span class="text-[11px] font-bold text-white w-5 text-center">${item.qty}</span>
                        <button class="btn-plus w-5 h-5 rounded bg-[#1C64F2] hover:bg-[#1A56DB] flex items-center justify-center" data-id="${item.id}">
                            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>
                    <div class="text-right flex-shrink-0 min-w-[52px]">
                        <p class="text-[11px] font-bold text-white">$${Number(lineTotal).toLocaleString('es-MX')}</p>
                        <button class="btn-remove text-[9px] text-[#EA0234] hover:underline mt-0.5" data-id="${item.id}">Quitar</button>
                    </div>
                </div>
            `;
        }).join('');

        $('#productsContainer').html(`<div class="px-3 py-2 space-y-1.5">${html}</div>`);
        $('#btnEliminarTicket').removeClass('hidden');

        const totalQty = this.cart.reduce((s, it) => s + it.qty, 0);
        $('#lblHeaderItems').text(`${this.cart.length} producto${this.cart.length !== 1 ? 's' : ''} — ${totalQty} pz${totalQty !== 1 ? 's' : ''}`);

        $('#productsContainer .btn-minus').on('click',  (e) => this.changeQty($(e.currentTarget).data('id'), -1));
        $('#productsContainer .btn-plus').on('click',   (e) => this.changeQty($(e.currentTarget).data('id'), +1));
        $('#productsContainer .btn-remove').on('click', (e) => this.removeFromCart($(e.currentTarget).data('id')));

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    updateTotals() {
        const subtotal = this.cart.reduce((s, it) => {
            const p = this.products.find(x => x.id == it.id);
            return s + (p ? p.price * it.qty : 0);
        }, 0);

        let discount = 0;
        if (this.accountDiscount) {
            discount = this.accountDiscount.type === 'porcentaje'
                ? subtotal * (this.accountDiscount.value / 100)
                : Math.min(this.accountDiscount.value, subtotal);
        }

        const total    = subtotal - discount;
        const totalQty = this.cart.reduce((s, it) => s + it.qty, 0);
        const fmt      = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 });

        $('#lblSubtotal').text(fmt(subtotal));
        $('#lblTotal').text(fmt(total));
        $('#lblItemsCount').text(`${this.cart.length} items, ${totalQty} pzas vendidas`);

        if (discount > 0) {
            $('#rowDescuento').removeClass('hidden');
            $('#lblDescuento').text('-' + fmt(discount));
        } else {
            $('#rowDescuento').addClass('hidden');
        }
    }

    // ── HU-02: Footer de acciones ─────────────────────────────────────────────
    renderSalesActions() {
        $('#salesActions').html(`
            <div class="border-t border-[#374151] px-4 py-3">
                <div class="grid grid-cols-4 gap-1.5">
                    <button id="btnDescuento" class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a2332] border border-[#374151] text-[10px] text-[#9CA3AF] hover:text-[#fbbf24] hover:border-[rgba(251,191,36,0.4)] transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                        Descuento
                    </button>
                    <button id="btnNota" class="relative flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a2332] border border-[#374151] text-[10px] text-[#9CA3AF] hover:text-[#76A9FA] hover:border-[rgba(118,169,250,0.4)] transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        <span id="lblBtnNota">Nota</span>
                    </button>
                    <button id="btnImprimir" class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a2332] border border-[#374151] text-[10px] text-[#9CA3AF] hover:text-[#3FC189] hover:border-[rgba(63,193,137,0.4)] transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                        Imprimir
                    </button>
                    <button id="btnPagar" class="py-1.5 rounded-lg text-xs font-extrabold bg-[#1C64F2] text-white shadow-lg shadow-[rgba(28,100,242,0.25)] hover:bg-[#1a53d4] active:scale-[0.98] transition-all">
                        PAGAR
                    </button>
                </div>

                <p id="lblItemsCount" class="text-[10px] text-[#6B7280] mt-2">0 items, 0 pzas vendidas</p>

                <div class="mt-2 space-y-1">
                    <div class="flex justify-between text-[11px] text-[#9CA3AF]">
                        <span>Subtotal</span>
                        <span id="lblSubtotal">$0.00</span>
                    </div>
                    <div id="rowDescuento" class="hidden flex justify-between text-[11px] text-[#fbbf24]">
                        <span>Descuento</span>
                        <span id="lblDescuento">-$0.00</span>
                    </div>
                    <div class="flex justify-between text-base font-extrabold pt-1.5 border-t border-[#374151]">
                        <span>TOTAL</span>
                        <span id="lblTotal" class="text-[#3FC189]">$0.00</span>
                    </div>
                </div>
            </div>
        `);

        $('#btnDescuento').on('click', () => this.openDiscountModal());
        $('#btnNota').on('click',      () => this.openNotaModal());
        $('#btnImprimir').on('click',  () => this.openImprimirModal());
        $('#btnPagar').on('click',     () => this.openPagarModal());
    }

    // ── HU-05: Cancelar ticket ────────────────────────────────────────────────
    confirmEliminarTicket() {
        if (!this.cart.length) return;
        // TODO: SweetAlert confirm → DELETE /ctrl-pos.php opc:deleteTicket → resetTicket()
    }

    resetTicket() {
        this.cart            = [];
        this.accountDiscount = null;
        this.ticketNote      = null;
        this.selectedClient  = null;
        this.renderCart();
        this.updateTotals();
        this.clearCliente();
        $('#lblBtnNota').text('Nota');
    }

    // ── Cliente ───────────────────────────────────────────────────────────────
    searchClients(q) {
        if (!q || q.length < 2) {
            $('#clienteDropdown').addClass('hidden').html('');
            return;
        }
        // TODO: fetch clientes → renderClienteDropdown(results)
    }

    clearCliente() {
        this.selectedClient = null;
        $('#inputCliente').val('');
        $('#btnClearCliente').addClass('hidden');
        $('#clienteSelected').addClass('hidden').html('');
        $('#clienteDropdown').addClass('hidden').html('');
    }

    // ── Stubs HU-03/04/06/07/08 (se implementan en iteraciones siguientes) ────
    openPagarModal()     { /* HU-03 */ }
    openDiscountModal()  { /* HU-04 */ }
    openNotaModal()      { /* HU-06 */ }
    openImprimirModal()  { /* HU-07 */ }
    openCierreModal()    { /* HU-08 */ }
    openNewClientModal() { /* HU-02 agregar cliente */ }
}
