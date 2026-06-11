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
        this.products        = data.products        || [];
        this.turno           = data.turno           || null;
        this.sucursal        = data.sucursal        || '';
        this.vendedor        = data.vendedor        || '';
        this.folioNum        = data.folio           || 1;
        this.paymentTypes    = data.paymentTypes    || [];
        this.discountReasons = data.discountReasons || [];
        this.categories      = ['Todos', ...new Set(this.products.map(p => p.category || 'Sin categoría'))];
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
        this.checkTurno();
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

        this.injectSwalTheme();
    }

    //  Helpers

    fmt(n)  { return '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    esc(s)  { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    swalBase() {
        return { customClass: { popup: 'huubie-swal' }, buttonsStyling: false };
    }

    toast(title, icon = 'success') {
        Swal.fire({ ...this.swalBase(), icon, title, toast: true, position: 'top-end', showConfirmButton: false, timer: 2200, timerProgressBar: true });
    }

    injectSwalTheme() {
        if (document.getElementById('huubieSwalTheme')) return;
        $('head').append(`
            <style id="huubieSwalTheme">
                .swal2-popup.huubie-swal { background:#1F2A37 !important; border:1px solid #374151 !important; border-radius:16px !important; color:#fff !important; font-family:'Inter',system-ui,sans-serif !important; padding:1.5rem !important; }
                .swal2-popup.huubie-swal .swal2-title { color:#fff !important; font-size:1rem !important; font-weight:700 !important; }
                .swal2-popup.huubie-swal .swal2-html-container { color:#9CA3AF !important; font-size:0.813rem !important; }
                .swal2-popup.huubie-swal .swal2-confirm { background:#1C64F2 !important; color:#fff !important; font-size:0.75rem !important; font-weight:700 !important; padding:0.5rem 1.25rem !important; border-radius:0.5rem !important; }
                .swal2-popup.huubie-swal .swal2-confirm.swal-danger { background:#EA0234 !important; }
                .swal2-popup.huubie-swal .swal2-confirm.swal-purple { background:#7C3AED !important; }
                .swal2-popup.huubie-swal .swal2-confirm.swal-green  { background:#3FC189 !important; }
                .swal2-popup.huubie-swal .swal2-cancel { background:transparent !important; color:#9CA3AF !important; font-size:0.75rem !important; font-weight:600 !important; padding:0.5rem 1rem !important; border:1px solid #374151 !important; border-radius:0.5rem !important; }
                .swal2-popup.huubie-swal .swal2-input, .swal2-popup.huubie-swal .swal2-textarea, .swal2-popup.huubie-swal .swal2-select { background:#1a2332 !important; border:1px solid #374151 !important; color:#fff !important; border-radius:0.5rem !important; }
                .swal2-popup.huubie-swal .swal2-validation-message { background:rgba(234,2,52,0.08) !important; color:#EA0234 !important; }
                @keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:.5;} }
                .pulse-dot { animation:pulse-dot 2s ease-in-out infinite; }
                @keyframes slideIn { from{opacity:0;transform:translateX(10px);} to{opacity:1;transform:translateX(0);} }
            </style>
        `);
    }

    _categoryIcon(category) {
        const c = String(category || '').toUpperCase();
        if (c.includes('GALLETA'))                       return 'cookie';
        if (c.includes('PAN'))                           return 'croissant';
        if (c.includes('PORCI'))                         return 'cake-slice';
        if (c.includes('POSTRE'))                        return 'dessert';
        if (c.includes('BOCADILLO'))                     return 'sandwich';
        if (c.includes('CHAROLA'))                       return 'utensils';
        if (c.includes('PEDIDO'))                        return 'clipboard-list';
        if (c.includes('PASTEL') || c.includes('LECHES')) return 'cake';
        return 'package';
    }

    //  HU-01: Header turno
    renderInfoHeader() {
        const turnoActive = !!this.turno;
        const opened      = turnoActive ? new Date(String(this.turno.opened_at).replace(' ', 'T')) : null;
        const sameDay     = opened ? opened.toDateString() === new Date().toDateString() : true;

        const badge = turnoActive
            ? `<div class="flex items-center gap-1.5 px-2.5 py-1 ${sameDay ? 'bg-[rgba(63,193,137,0.12)] border-[rgba(63,193,137,0.3)]' : 'bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.3)]'} border rounded-lg">
                    <div class="w-1.5 h-1.5 rounded-full ${sameDay ? 'bg-[#3FC189]' : 'bg-[#fbbf24]'} pulse-dot"></div>
                    <span class="text-[10px] font-semibold ${sameDay ? 'text-[#3FC189]' : 'text-[#fbbf24]'}">${this.esc((this.turno.nombre || 'TURNO ABIERTO').toUpperCase())}${sameDay ? '' : ' (OTRO DÍA)'}</span>
               </div>`
            : `<div class="flex items-center gap-1.5 px-2.5 py-1 bg-[rgba(234,2,52,0.12)] border border-[rgba(234,2,52,0.3)] rounded-lg">
                    <div class="w-1.5 h-1.5 rounded-full bg-[#EA0234]"></div>
                    <span class="text-[10px] font-semibold text-[#EA0234]">SIN TURNO</span>
               </div>`;

        const btnTurno = turnoActive
            ? `<button id="btnToggleTurno" class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(234,2,52,0.12)] border border-[rgba(234,2,52,0.3)] text-[#f87171] hover:bg-[rgba(234,2,52,0.25)] hover:text-white transition-colors">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span class="font-semibold">Cerrar turno</span>
               </button>`
            : `<button id="btnToggleTurno" class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(63,193,137,0.12)] border border-[rgba(63,193,137,0.3)] text-[#3FC189] hover:bg-[rgba(63,193,137,0.25)] hover:text-white transition-colors">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    <span class="font-semibold">Abrir turno</span>
               </button>`;

        $('#infoHeader').html(`
            <div class="flex items-center justify-between px-4 py-2.5 bg-[#0E1521] border-b border-[#374151]">
                <div class="flex items-center gap-3">
                    ${badge}
                    <span class="text-[10px] text-[#6B7280]">${this.esc(this.sucursal || '')}  ${this.esc(this.vendedor || '')}</span>
                </div>
                <div class="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
                    <span>Ventas: <strong class="text-[#3FC189]">${this.fmt(this.turno?.ventas || 0)}</strong></span>
                    <span class="text-[#374151]">|</span>
                    <span>Ordenes: <strong class="text-white">${this.turno?.ordenes || 0}</strong></span>
                    <span class="text-[#374151]">|</span>
                    ${btnTurno}
                    <button id="btnCierreDay" class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.3)] text-[#c4b5fd] hover:bg-[rgba(124,58,237,0.25)] hover:text-white transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <span class="font-semibold">Cierre del dia</span>
                    </button>
                    <span class="text-[#374151]">|</span>
                    <a href="pos-historial-ventas.php" class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(28,100,242,0.12)] border border-[rgba(28,100,242,0.3)] text-[#76A9FA] hover:bg-[rgba(28,100,242,0.25)] hover:text-white transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                        <span class="font-semibold">Historial</span>
                    </a>
                </div>
            </div>
        `);

        $('#btnToggleTurno').on('click', () => this.turno ? this.closeShiftFlow() : this.openShiftModal(false));
        $('#btnCierreDay').on('click',   () => this.toast('Cierre del día disponible prÃ³ximamente', 'info'));
    }

    //  HU-08: Turno obligatorio â”€
    checkTurno() {
        if (!this.turno) this.openShiftModal(true);
    }

    async openShiftModal(blocking) {
        const result = await Swal.fire({
            ...this.swalBase(),
            title: 'Abrir turno',
            html: `
                <div class="text-left space-y-3 mt-2">
                    <p class="text-[11px] text-[#9CA3AF]">${blocking ? 'No hay un turno abierto en <b class="text-white">' + this.esc(this.sucursal) + '</b>. Para vender es necesario abrir uno.' : 'Captura el fondo inicial de caja.'}</p>
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1 text-left">Nombre del turno (opcional)</label>
                        <input id="swalShiftName" class="swal2-input !m-0 !w-full !h-auto !py-2 !px-3 !text-xs" type="text" placeholder="Ej. Matutino">
                    </div>
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1 text-left">Fondo de caja <span class="text-[#EA0234]">*</span></label>
                        <input id="swalShiftAmount" class="swal2-input !m-0 !w-full !h-auto !py-2 !px-3 !text-xs" type="number" min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
            `,
            confirmButtonText: 'Abrir turno',
            showCancelButton: !blocking,
            cancelButtonText: 'Cancelar',
            allowOutsideClick: !blocking,
            allowEscapeKey: !blocking,
            customClass: { popup: 'huubie-swal', confirmButton: 'swal-green' },
            didOpen: () => document.getElementById('swalShiftAmount').focus(),
            preConfirm: () => {
                const amount = parseFloat(document.getElementById('swalShiftAmount').value);
                if (isNaN(amount) || amount < 0) {
                    Swal.showValidationMessage('Captura un fondo de caja válido (puede ser 0)');
                    return false;
                }
                return { shift_name: document.getElementById('swalShiftName').value.trim(), opening_amount: amount };
            }
        });

        if (!result.value) {
            if (blocking) this.openShiftModal(true);
            return;
        }

        const res = await useFetch({ url: this._link, data: { opc: 'openShift', ...result.value } });

        if (res.status === 200 || res.status === 409) {
            this.turno    = res.turno;
            this.vendedor = res.vendedor || this.turno?.employee || this.vendedor;
            this.renderInfoHeader();
            this.renderSalesInfo();
            if (res.status === 200) this.toast('Turno abierto correctamente');
            else this.toast(res.message, 'info');
        } else {
            this.toast(res.message || 'Error al abrir el turno', 'error');
            if (blocking) this.openShiftModal(true);
        }
    }

    async closeShiftFlow() {
        if (!this.turno) return;

        const confirm = await Swal.fire({
            ...this.swalBase(),
            icon: 'question',
            title: '¿Cerrar el turno actual?',
            html: `Se realizará el corte de caja con <b class="text-white">${this.turno.ordenes}</b> orden(es) y ventas por <b class="text-[#3FC189]">${this.fmt(this.turno.ventas)}</b>.`,
            showCancelButton: true,
            confirmButtonText: 'Si, cerrar turno',
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'huubie-swal', confirmButton: 'swal-purple' },
            focusCancel: true
        });
        if (!confirm.isConfirmed) return;

        const res = await useFetch({ url: this._link, data: { opc: 'closeShift', shift_id: this.turno.id } });

        if (res.status !== 200) {
            this.toast(res.message || 'No se pudo cerrar el turno', 'error');
            return;
        }

        const r = res.resumen;
        await Swal.fire({
            ...this.swalBase(),
            icon: 'success',
            title: 'Turno cerrado',
            html: `
                <div class="text-left text-xs space-y-1 mt-2">
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Fondo de caja</span><span class="text-white font-bold">${this.fmt(r.fondo)}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Ventas</span><span class="text-[#3FC189] font-bold">${this.fmt(r.ventas)}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Ordenes</span><span class="text-white font-bold">${r.ordenes}</span></div>
                    <div class="flex justify-between gap-4 pt-2 mt-2 border-t border-[#374151]"><span class="text-[#9CA3AF]">Efectivo</span><span class="text-white font-bold">${this.fmt(r.cash)}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Tarjeta</span><span class="text-white font-bold">${this.fmt(r.card)}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Transferencia</span><span class="text-white font-bold">${this.fmt(r.transfer)}</span></div>
                </div>
            `,
            confirmButtonText: 'Aceptar'
        });

        this.turno = null;
        this.resetTicket();
        this.renderInfoHeader();
        this.renderSalesInfo();
        this.openShiftModal(true);
    }

    //  HU-01: Busqueda + categorias 
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
            return `<button class="${base} ${style}" data-cat="${this.esc(cat)}">${this.esc(cat)}</button>`;
        }).join('');

        $('#catContainer').html(html);
        $('#catContainer button').on('click', (e) => {
            this.activeCategory = $(e.currentTarget).data('cat');
            this.renderCategories();
            this.renderProducts();
        });
    }

    //  HU-01: Grid de productos â”€
    renderProducts() {
        const q        = this.searchQuery.trim().toLowerCase();
        const filtered = this.products.filter(p => {
            const cat         = p.category || 'Sin categorÃ­a';
            const matchCat    = this.activeCategory === 'Todos' || cat === this.activeCategory;
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
            if (!p || Number(p.stock) <= 0) return;
            this.addToCart(id);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    _productCardHtml(p) {
        const stock   = Number(p.stock) || 0;
        const st      = this._productStatus(p);
        const isOut   = stock <= 0;
        const opacity = isOut ? 'opacity-50' : '';
        const cursor  = isOut ? 'cursor-not-allowed' : 'cursor-pointer';
        const icon    = this._categoryIcon(p.category);
        const hasImg  = p.image && String(p.image).trim() !== '';

        const visual = hasImg
            ? `<img src="${this.esc(p.image)}" class="w-full h-full object-cover" onerror="this.outerHTML='<i data-lucide=\\'${icon}\\' class=\\'w-6 h-6 text-[#9CA3AF]\\'></i>'; lucide.createIcons();">`
            : `<i data-lucide="${icon}" class="w-6 h-6 text-[#9CA3AF]"></i>`;

        return `
            <div class="product-card bg-[#1F2A37] rounded-lg overflow-hidden border border-[rgba(55,65,81,0.5)] transition-all hover:border-[#7C3AED] hover:shadow-[0_8px_24px_rgba(124,58,237,0.12)] ${opacity} ${cursor}" data-id="${p.id}">
                <div class="h-16 flex items-center justify-center relative bg-[#141d2b] overflow-hidden">
                    ${visual}
                    <span class="absolute top-1 left-1 px-1 rounded text-[7px] font-bold" style="background:${st.bg};color:${st.fg}">${st.label}</span>
                    ${stock > 0 ? `<span class="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[rgba(124,58,237,0.25)] text-[9px] font-bold flex items-center justify-center text-[#c4b5fd]" title="Inventario disponible">${stock}</span>` : ''}
                </div>
                <div class="p-2.5">
                    <p class="text-[10px] font-semibold truncate leading-tight text-white" title="${this.esc(p.name)}">${this.esc(p.name)}</p>
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

    // Semáforo contra el stock mí­nimo real (product_attribute.stock_min)
    _productStatus(p) {
        const stock = Number(p.stock) || 0;
        const min   = Number(p.stock_min) || 0;
        if (stock <= 0)               return { label: 'Agotado',    fg: '#EA0234', bg: 'rgba(234,2,52,0.15)' };
        if (min > 0 && stock <= min)  return { label: 'Bajo stock', fg: '#FBBF24', bg: 'rgba(251,191,36,0.15)' };
        return                               { label: 'Disponible', fg: '#3FC189', bg: 'rgba(63,193,137,0.15)' };
    }

    //  HU-02: Header del ticket + selector cliente â”€
    renderSalesInfo() {
        const opened = this.turno ? new Date(String(this.turno.opened_at).replace(' ', 'T')) : new Date();
        const fecha  = opened.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

        $('#salesInfo').html(`
            <div class="px-4 py-3 border-b border-[#374151] bg-[#141d2b]">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm font-bold text-white">Venta #${this.folioNum}</h2>
                            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[rgba(124,58,237,0.15)] text-[#c4b5fd] border border-[rgba(124,58,237,0.35)]">POS</span>
                        </div>
                        <p class="text-[10px] text-[#6B7280] mt-0.5" id="lblHeaderItems">0 items  Venta directa</p>
                        <p class="text-[10px] text-[#6B7280] capitalize">${fecha}</p>
                    </div>
                    <button id="btnEliminarTicket" class="hidden w-7 h-7 rounded-lg bg-[#1a2332] border border-[rgba(234,2,52,0.35)] flex items-center justify-center text-[#EA0234] hover:bg-[#EA0234] hover:text-white transition-colors" title="Eliminar ticket">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>

                <div class="relative mt-2" id="clienteWrapper">
                    <div class="flex gap-2">
                        <div class="flex-1 relative">
                            <div id="clienteInputWrap" class="flex items-center gap-2 bg-[#1a2332] rounded-lg px-2.5 py-1.5 border border-[#374151] focus-within:border-[#7C3AED] transition-colors">
                                <svg id="clienteIcon" class="w-3 h-3 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
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
                </div>
            </div>
        `);

        $('#btnEliminarTicket').on('click', () => this.confirmEliminarTicket());
        $('#btnAgregarCliente').on('click', () => this.openNewClientModal($('#inputCliente').val().trim()));
        $('#btnClearCliente').on('click',   (e) => { e.stopPropagation(); this.clearCliente(); });

        let debounce;
        $('#inputCliente').on('input', (e) => {
            const term = e.target.value;
            if (this.selectedClient && term !== this.selectedClient.name) this.clearCliente(true);
            clearTimeout(debounce);
            debounce = setTimeout(() => this.searchClients(term), 250);
        });

        $(document).off('click.posCliente').on('click.posCliente', (e) => {
            if (!$(e.target).closest('#clienteWrapper').length) $('#clienteDropdown').addClass('hidden');
        });
    }

    //  Cliente
    async searchClients(q) {
        if (!q || q.trim().length < 2) {
            $('#clienteDropdown').addClass('hidden').html('');
            return;
        }

        const res     = await useFetch({ url: this._link, data: { opc: 'searchClientsPos', term: q.trim() } });
        const clients = res.clients || [];

        let html = clients.length === 0
            ? `<div class="px-3 py-2.5 text-center"><p class="text-[10px] text-[#6B7280]">Sin coincidencias</p></div>`
            : clients.map(c => {
                const meta = [c.phone, c.email].filter(Boolean).join(' Â· ') || 'Sin contacto';
                return `
                    <button type="button" data-cid="${c.id}" class="cliente-item w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1a2332] text-left border-b border-[#374151]/40">
                        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[8px] font-bold flex-shrink-0 text-white">${this.esc(this._initials(c.name))}</div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-semibold text-white truncate">${this.esc(c.name)}</p>
                            <p class="text-[9px] text-[#9CA3AF] truncate">${this.esc(meta)}</p>
                        </div>
                    </button>
                `;
            }).join('');

        html += `
            <button type="button" id="btnAddFromDropdown" class="w-full flex items-center gap-2 px-3 py-2 bg-[rgba(28,100,242,0.08)] hover:bg-[rgba(28,100,242,0.15)] text-left border-t border-[#374151]">
                <div class="w-6 h-6 rounded-full bg-[#1C64F2] flex items-center justify-center flex-shrink-0">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </div>
                <p class="text-[10px] font-semibold text-[#76A9FA]">Agregar cliente nuevo "${this.esc(q.trim())}"</p>
            </button>
        `;

        $('#clienteDropdown').html(html).removeClass('hidden');

        $('#clienteDropdown .cliente-item').on('click', (e) => {
            const id = $(e.currentTarget).data('cid');
            const c  = clients.find(x => x.id == id);
            if (c) this.setCliente(c);
        });
        $('#btnAddFromDropdown').on('click', () => {
            $('#clienteDropdown').addClass('hidden');
            this.openNewClientModal(q.trim());
        });
    }

    _initials(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    setCliente(c) {
        this.selectedClient = c;
        $('#inputCliente').val(c.name);
        $('#btnClearCliente').removeClass('hidden');
        $('#clienteIcon').removeClass('text-[#6B7280]').addClass('text-[#F472B6]');
        $('#clienteDropdown').addClass('hidden').html('');
    }

    clearCliente(keepText = false) {
        this.selectedClient = null;
        if (!keepText) $('#inputCliente').val('');
        $('#btnClearCliente').addClass('hidden');
        $('#clienteIcon').removeClass('text-[#F472B6]').addClass('text-[#6B7280]');
        $('#clienteDropdown').addClass('hidden').html('');
    }

    async openNewClientModal(prefillName = '') {
        const result = await Swal.fire({
            ...this.swalBase(),
            title: 'Agregar cliente nuevo',
            html: `
                <div class="text-left space-y-3 mt-2">
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1">Nombre <span class="text-[#EA0234]">*</span></label>
                        <input id="swalClienteName" class="swal2-input !m-0 !w-full !h-auto !py-2 !px-3 !text-xs" type="text" placeholder="Nombre completo" value="${this.esc(prefillName)}">
                    </div>
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1">Telefono (opcional)</label>
                        <input id="swalClientePhone" class="swal2-input !m-0 !w-full !h-auto !py-2 !px-3 !text-xs" type="tel" placeholder="10 digitos" maxlength="15">
                    </div>
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1">Correo (opcional)</label>
                        <input id="swalClienteEmail" class="swal2-input !m-0 !w-full !h-auto !py-2 !px-3 !text-xs" type="email" placeholder="correo@ejemplo.com">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar cliente',
            cancelButtonText: 'Cancelar',
            didOpen: () => document.getElementById('swalClienteName').focus(),
            preConfirm: () => {
                const name  = document.getElementById('swalClienteName').value.trim();
                const phone = document.getElementById('swalClientePhone').value.trim();
                const email = document.getElementById('swalClienteEmail').value.trim();

                if (!name) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
                if (phone && !/^[0-9+()\s-]{7,15}$/.test(phone)) { Swal.showValidationMessage('Telefono invalido (7 a 15 digitos)'); return false; }
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Swal.showValidationMessage('Correo invalido'); return false; }
                return { name, phone, email };
            }
        });

        if (!result.value) return;

        const res = await useFetch({ url: this._link, data: { opc: 'createClientPos', ...result.value } });

        if (res.status === 200 && res.client) {
            this.setCliente(res.client);
            this.toast('Cliente registrado correctamente');
        } else {
            this.toast(res.message || 'No se pudo registrar el cliente', 'error');
        }
    }

    //  HU-02: Carritoâ”€
    addToCart(id) {
        if (!this.turno) { this.openShiftModal(true); return; }

        const p = this.products.find(x => x.id == id);
        if (!p) return;

        const stock    = Number(p.stock) || 0;
        const existing = this.cart.find(it => it.id == id);
        const inCart   = existing ? existing.qty : 0;

        if (inCart + 1 > stock) {
            this.toast(`Solo hay ${stock} pza(s) de ${p.name}`, 'warning');
            return;
        }

        if (existing) existing.qty += 1;
        else this.cart.push({ id, qty: 1, discount: 0, reason_id: null });

        this.renderCart();
        this.updateTotals();
    }

    changeQty(id, delta) {
        const item = this.cart.find(it => it.id == id);
        if (!item) return;

        const p = this.products.find(x => x.id == id);
        if (delta > 0 && p && item.qty + delta > (Number(p.stock) || 0)) {
            this.toast(`Solo hay ${p.stock} pza(s) disponibles`, 'warning');
            return;
        }

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
            $('#lblHeaderItems').text('0 items  Venta directa');
            return;
        }

        const html = this.cart.map(item => {
            const p = this.products.find(x => x.id == item.id);
            if (!p) return '';
            const bruto     = p.price * item.qty;
            const lineTotal = bruto * (1 - (item.discount || 0) / 100);
            const hasDisc   = (item.discount || 0) > 0;
            const icon      = this._categoryIcon(p.category);
            const hasImg    = p.image && String(p.image).trim() !== '';
            const visual    = hasImg
                ? `<img src="${this.esc(p.image)}" class="w-full h-full object-cover rounded-lg">`
                : `<i data-lucide="${icon}" class="w-4 h-4 text-[#9CA3AF]"></i>`;

            return `
                <div class="cart-item flex items-center gap-2 p-2 rounded-lg bg-[#1a2332] border border-[#374151] ${hasDisc ? 'border-l-2 border-l-[#fbbf24]' : ''}" style="animation:slideIn .15s ease">
                    <div class="w-8 h-8 rounded-lg bg-[#141d2b] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        ${visual}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-semibold text-white truncate">${this.esc(p.name)}</p>
                        <p class="text-[10px] text-[#6B7280]">$${Number(p.price).toLocaleString('es-MX')} c/u ${hasDisc ? `<span class="text-[#fbbf24] font-bold">-${item.discount}%</span>` : ''}</p>
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
                    <div class="text-right flex-shrink-0 min-w-[58px]">
                        ${hasDisc ? `<p class="text-[9px] text-[#6B7280] line-through">$${Number(bruto).toLocaleString('es-MX')}</p>` : ''}
                        <p class="text-[11px] font-bold text-white">$${Number(lineTotal).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</p>
                        <div class="flex items-center justify-end gap-1 mt-0.5">
                            <button class="btn-item-discount w-5 h-5 rounded bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.3)] flex items-center justify-center text-[#fbbf24] hover:bg-[rgba(251,191,36,0.25)]" data-id="${item.id}" title="Descuento al producto">
                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                            </button>
                            <button class="btn-remove w-5 h-5 rounded bg-[rgba(234,2,52,0.12)] border border-[rgba(234,2,52,0.3)] flex items-center justify-center text-[#EA0234] hover:bg-[rgba(234,2,52,0.25)]" data-id="${item.id}" title="Quitar del ticket">
                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        $('#productsContainer').html(`<div class="px-3 py-2 space-y-1.5">${html}</div>`);
        $('#btnEliminarTicket').removeClass('hidden');

        const totalQty = this.cart.reduce((s, it) => s + it.qty, 0);
        $('#lblHeaderItems').text(`${this.cart.length} producto${this.cart.length !== 1 ? 's' : ''}  ${totalQty} pz${totalQty !== 1 ? 's' : ''}`);

        $('#productsContainer .btn-minus').on('click',         (e) => this.changeQty($(e.currentTarget).data('id'), -1));
        $('#productsContainer .btn-plus').on('click',          (e) => this.changeQty($(e.currentTarget).data('id'), +1));
        $('#productsContainer .btn-remove').on('click',        (e) => this.removeFromCart($(e.currentTarget).data('id')));
        $('#productsContainer .btn-item-discount').on('click', (e) => this.openDiscountModal('item', $(e.currentTarget).data('id')));

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    //  Totales
    getTotals() {
        let subtotal = 0, descItems = 0;
        this.cart.forEach(it => {
            const p = this.products.find(x => x.id == it.id);
            if (!p) return;
            const bruto = p.price * it.qty;
            subtotal  += bruto;
            descItems += bruto * ((it.discount || 0) / 100);
        });

        const base = subtotal - descItems;
        let descCuenta = 0;
        if (this.accountDiscount) {
            descCuenta = this.accountDiscount.type === 'porcentaje'
                ? base * (this.accountDiscount.value / 100)
                : Math.min(this.accountDiscount.value, base);
        }

        const descuento = descItems + descCuenta;
        const total     = subtotal - descuento;
        // Informativo: IVA incluido en el precio (16%). Pendiente tasa por producto en BD.
        const iva       = total - (total / 1.16);

        return { subtotal, descuento, total, iva };
    }

    updateTotals() {
        const { subtotal, descuento, total, iva } = this.getTotals();
        const totalQty = this.cart.reduce((s, it) => s + it.qty, 0);

        $('#lblSubtotal').text(this.fmt(subtotal));
        $('#lblImpuestos').text(this.fmt(iva));
        $('#lblTotal').text(this.fmt(total));
        $('#lblItemsCount').text(`${this.cart.length} items, ${totalQty} pzas vendidas`);

        if (descuento > 0) {
            $('#rowDescuento').removeClass('hidden');
            $('#lblDescuento').text('-' + this.fmt(descuento));
        } else {
            $('#rowDescuento').addClass('hidden');
        }
    }

    //  HU-02: Footer de acciones 
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
                    <div class="flex justify-between text-[11px] text-[#6B7280]">
                        <span>Impuestos (IVA incluido)</span>
                        <span id="lblImpuestos">$0.00</span>
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

        $('#btnDescuento').on('click', () => this.openDiscountModal('order'));
        $('#btnNota').on('click',      () => this.openNotaModal());
        $('#btnImprimir').on('click',  () => this.openImprimirModal());
        $('#btnPagar').on('click',     () => this.openPagarModal());
    }

    //  HU-05: Cancelar ticket
    async confirmEliminarTicket() {
        if (!this.cart.length) return;

        const result = await Swal.fire({
            ...this.swalBase(),
            icon: 'warning',
            title: '¿Eliminar el ticket actual?',
            text: 'Se perderan los productos agregados, el descuento y la nota del ticket.',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'huubie-swal', confirmButton: 'swal-danger' },
            focusCancel: true
        });

        if (result.isConfirmed) {
            this.resetTicket();
            this.toast('Ticket eliminado');
        }
    }

    resetTicket() {
        this.cart            = [];
        this.accountDiscount = null;
        this.ticketNote      = null;
        this.renderCart();
        this.updateTotals();
        this.clearCliente();
        $('#lblBtnNota').text('Nota');
    }

    //  HU-04: Descuentos â”€
    async openDiscountModal(scope = 'order', itemId = null) {
        if (!this.cart.length) {
            this.toast('Agrega productos al ticket antes de aplicar un descuento', 'warning');
            return;
        }

        const isItem  = scope === 'item';
        const item    = isItem ? this.cart.find(it => it.id == itemId) : null;
        const product = isItem ? this.products.find(p => p.id == itemId) : null;

        const reasons = this.discountReasons.map(r =>
            `<option value="${r.id}" data-max="${r.max_percentage}" data-auth="${r.requires_authorization}">${this.esc(r.name)} (máx ${r.max_percentage}%)</option>`
        ).join('');

        const typeButtons = isItem ? '' : `
            <div class="grid grid-cols-2 gap-2 mb-1" id="swalDiscTypes">
                <button type="button" data-type="porcentaje" class="swal-disc-type px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors">Porcentaje %</button>
                <button type="button" data-type="monto" class="swal-disc-type px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors">Monto fijo $</button>
            </div>
        `;

        const result = await Swal.fire({
            ...this.swalBase(),
            title: isItem ? 'Descuento al producto' : 'Aplicar descuento',
            html: `
                <div class="text-left space-y-3 mt-2">
                    ${isItem ? `<p class="text-[11px] text-[#9CA3AF]">Producto: <b class="text-white">${this.esc(product?.name || '')}</b></p>` : ''}
                    ${typeButtons}
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1"><span id="swalDiscLbl">${isItem ? 'Porcentaje' : 'Porcentaje'}</span> <span class="text-[#EA0234]">*</span></label>
                        <input id="swalDiscValue" class="swal2-input !m-0 !w-full !h-auto !py-2 !px-3 !text-xs" type="number" min="0" step="0.01" placeholder="0" value="${isItem && item?.discount ? item.discount : ''}">
                    </div>
                    <div>
                        <label class="block text-[9px] uppercase tracking-wider text-[#6B7280] font-bold mb-1">Motivo <span class="text-[#EA0234]">*</span></label>
                        <select id="swalDiscReason" class="swal2-select !m-0 !w-full !py-2 !px-3 !text-xs">
                            <option value="">Selecciona un motivo</option>
                            ${reasons}
                        </select>
                    </div>
                    <textarea id="swalDiscNotes" rows="2" placeholder="Detalle adicional (opcional)" class="swal2-textarea !m-0 !w-full !py-2 !px-3 !text-xs !resize-none"></textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Aplicar descuento',
            cancelButtonText: 'Cancelar',
            didOpen: () => {
                let discType = 'porcentaje';
                const paint = () => {
                    document.querySelectorAll('.swal-disc-type').forEach(b => {
                        const active = b.dataset.type === discType;
                        b.style.borderColor = active ? '#fbbf24' : '#374151';
                        b.style.background  = active ? 'rgba(251,191,36,0.08)' : '#1a2332';
                        b.style.color       = '#fff';
                    });
                    const lbl = document.getElementById('swalDiscLbl');
                    if (lbl) lbl.textContent = discType === 'monto' ? 'Monto (MXN)' : 'Porcentaje';
                };
                document.querySelectorAll('.swal-disc-type').forEach(b => {
                    b.addEventListener('click', () => { discType = b.dataset.type; paint(); });
                });
                paint();
                Swal.getPopup().dataset.discType = discType;
                document.querySelectorAll('.swal-disc-type').forEach(b => {
                    b.addEventListener('click', () => { Swal.getPopup().dataset.discType = b.dataset.type; });
                });
            },
            preConfirm: () => {
                const type   = isItem ? 'porcentaje' : (Swal.getPopup().dataset.discType || 'porcentaje');
                const value  = parseFloat(document.getElementById('swalDiscValue').value);
                const select = document.getElementById('swalDiscReason');
                const notes  = document.getElementById('swalDiscNotes').value.trim();

                if (isNaN(value) || value <= 0) { Swal.showValidationMessage('Ingresa un valor de descuento válido'); return false; }
                if (type === 'porcentaje' && value > 100) { Swal.showValidationMessage('El porcentaje no puede exceder 100%'); return false; }
                if (!select.value) { Swal.showValidationMessage('Selecciona el motivo del descuento'); return false; }

                const opt = select.options[select.selectedIndex];
                const max = parseFloat(opt.dataset.max);

                if (type === 'porcentaje' && value > max) {
                    Swal.showValidationMessage(`El motivo "${opt.text}" permite máximo ${max}%`);
                    return false;
                }
                if (type === 'monto') {
                    const { subtotal } = app.getTotals();
                    if (value > subtotal) { Swal.showValidationMessage('El monto excede el subtotal de la cuenta'); return false; }
                }

                return { type, value, reason_id: parseInt(select.value), requires_auth: opt.dataset.auth === '1', notes };
            }
        });

        if (!result.value) return;

        // TODO HU-04: validar credenciales de gerente cuando requires_auth = 1
        if (isItem && item) {
            item.discount  = result.value.value;
            item.reason_id = result.value.reason_id;
            this.renderCart();
        } else {
            this.accountDiscount = result.value;
        }

        this.updateTotals();
        this.toast('Descuento aplicado');
    }

    //  HU-06: Nota del ticket
    async openNotaModal() {
        if (!this.cart.length) {
            this.toast('Agrega productos al ticket antes de agregar una nota', 'warning');
            return;
        }

        const result = await Swal.fire({
            ...this.swalBase(),
            title: 'Nota del ticket',
            input: 'textarea',
            inputValue: this.ticketNote || '',
            inputAttributes: { maxlength: 250, rows: 5, placeholder: 'Escribe una nota o comentario para esta venta...' },
            showCancelButton: true,
            confirmButtonText: 'Guardar nota',
            cancelButtonText: 'Cancelar',
            showDenyButton: !!this.ticketNote,
            denyButtonText: 'Eliminar nota',
            customClass: { popup: 'huubie-swal', denyButton: 'swal-danger' }
        });

        if (result.isDenied) {
            this.ticketNote = null;
            $('#lblBtnNota').text('Nota');
            this.toast('Nota eliminada');
            return;
        }

        if (result.isConfirmed) {
            const text = (result.value || '').trim();
            if (!text) { this.toast('La nota está vacía', 'warning'); return; }
            this.ticketNote = text;
            $('#lblBtnNota').html(`Nota <span class="ml-0.5 px-1 rounded-full bg-[#76A9FA] text-[#111928] text-[8px] font-bold">1</span>`);
            this.toast('Nota guardada');
        }
    }

    //  HU-07: Imprimir pre-cuenta
    openImprimirModal() {
        if (!this.cart.length) {
            this.toast('Agrega productos al ticket antes de imprimir', 'warning');
            return;
        }

        const { subtotal, descuento, total, iva } = this.getTotals();
        const fecha = new Date().toLocaleString('es-MX');

        const rows = this.cart.map(it => {
            const p = this.products.find(x => x.id == it.id);
            if (!p) return '';
            const neto = p.price * it.qty * (1 - (it.discount || 0) / 100);
            return `
                <tr>
                    <td>${this.esc(p.name)}${it.discount ? ` (-${it.discount}%)` : ''}</td>
                    <td style="text-align:center">${it.qty}</td>
                    <td style="text-align:right">${this.fmt(neto)}</td>
                </tr>
            `;
        }).join('');

        const w = window.open('', '_blank', 'width=420,height=720');
        if (!w) { this.toast('Permite las ventanas emergentes para imprimir', 'warning'); return; }

        w.document.write(`
            <!doctype html><html><head><meta charset="utf-8"><title>Pre-cuenta</title>
            <style>
                body { font-family:'Courier New',monospace; font-size:11px; max-width:300px; margin:0 auto; padding:16px; color:#111; }
                h2, h3, p { margin:2px 0; text-align:center; }
                table { width:100%; border-collapse:collapse; margin:8px 0; }
                td, th { padding:2px 0; font-size:11px; }
                th { text-align:left; border-bottom:1px dashed #999; }
                .tot { display:flex; justify-content:space-between; }
                .line { border-top:1px dashed #999; margin:6px 0; }
                .big { font-size:14px; font-weight:bold; }
            </style></head><body>
                <h2>${this.esc(this.sucursal || 'HUUBIE')}</h2>
                <p>PUNTO DE VENTA  PRE-CUENTA</p>
                <p>${fecha}</p>
                <p>Folio (preliminar): Venta #${this.folioNum}</p>
                <p>Cajero: ${this.esc(this.vendedor || '')}</p>
                ${this.selectedClient ? `<p>Cliente: ${this.esc(this.selectedClient.name)}</p>` : ''}
                <div class="line"></div>
                <table>
                    <tr><th>Producto</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr>
                    ${rows}
                </table>
                <div class="line"></div>
                <div class="tot"><span>Subtotal:</span><span>${this.fmt(subtotal)}</span></div>
                ${descuento > 0 ? `<div class="tot"><span>Descuento:</span><span>-${this.fmt(descuento)}</span></div>` : ''}
                <div class="tot"><span>IVA incluido:</span><span>${this.fmt(iva)}</span></div>
                <div class="tot big"><span>TOTAL:</span><span>${this.fmt(total)}</span></div>
                ${this.ticketNote ? `<div class="line"></div><p style="text-align:left"><b>NOTA:</b> ${this.esc(this.ticketNote)}</p>` : ''}
                <div class="line"></div>
                <p>*** PRE-CUENTA  NO ES COMPROBANTE DE PAGO ***</p>
                <p style="font-style:italic;font-weight:bold">Huubie</p>
            </body></html>
        `);
        w.document.close();
        setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
    }

    //  HU-03: Cobro 
    async openPagarModal() {
        if (!this.turno) { this.openShiftModal(true); return; }
        if (!this.cart.length) {
            this.toast('Agrega al menos un producto al ticket antes de cobrar', 'warning');
            return;
        }

        const { subtotal, descuento, total } = this.getTotals();
        const clientName = this.selectedClient?.name || 'Publico en general';

        // Estado local del modal: un renglón por tipo de pago del catálogo
        const methods = this.paymentTypes.map(t => ({
            id:      t.id,
            code:    t.code,
            name:    t.name,
            is_cash: Number(t.is_cash) === 1,
            active:  t.code === 'EFE',
            amount:  t.code === 'EFE' ? total : 0
        }));

        const rowsHtml = () => methods.map(m => `
            <div class="grid grid-cols-[70px_1fr_120px] items-center border-b border-[#374151] ${m.active ? 'bg-[rgba(28,100,242,0.04)]' : ''}">
                <div class="px-2.5 py-2 flex items-center gap-1.5">
                    <input type="checkbox" data-mid="${m.id}" ${m.active ? 'checked' : ''} class="pay-check w-3.5 h-3.5 accent-[#1C64F2]">
                    <span class="text-[10px] font-bold ${m.active ? 'text-[#76A9FA]' : 'text-[#6B7280]'}">${m.code}</span>
                </div>
                <div class="px-2.5 py-2 text-[11px] text-left ${m.active ? 'text-white' : 'text-[#9CA3AF]'}">${this.esc(m.name)}</div>
                <div class="px-2.5 py-2">
                    ${m.active
                        ? `<input type="number" step="0.01" min="0" value="${m.amount || ''}" placeholder="0.00" data-mid="${m.id}" class="pay-amount w-full bg-[#141d2b] border border-[#374151] rounded px-2 py-1 text-[11px] text-white text-right font-bold focus:outline-none focus:border-[#1C64F2]">`
                        : `<span class="block text-[10px] text-[#4B5563] text-right">$0.00</span>`}
                </div>
            </div>
        `).join('');

        const self = this;

        const result = await Swal.fire({
            ...this.swalBase(),
            title: 'Procesar pago',
            width: 560,
            html: `
                <div class="text-left space-y-3 mt-1">
                    <p class="text-[11px] text-[#9CA3AF]">Folio: <b class="text-white">Venta #${this.folioNum}</b> &nbsp;|&nbsp; Cliente: <b class="text-white">${this.esc(clientName)}</b></p>

                    <div class="bg-[#1a2332] rounded-lg p-3 border border-[#374151] space-y-1">
                        <div class="flex justify-between text-xs"><span class="text-[#9CA3AF]">Subtotal</span><span class="text-white">${this.fmt(subtotal)}</span></div>
                        ${descuento > 0 ? `<div class="flex justify-between text-xs"><span class="text-[#9CA3AF]">Descuento</span><span class="text-[#fbbf24]">-${this.fmt(descuento)}</span></div>` : ''}
                        <div class="flex justify-between pt-1 border-t border-[#374151]"><span class="text-sm font-bold text-white">Total M.N.</span><span class="text-sm font-bold text-[#3FC189]">${this.fmt(total)}</span></div>
                    </div>

                    <div class="rounded-lg border border-[#374151] overflow-hidden">
                        <div class="grid grid-cols-[70px_1fr_120px] bg-[#0E1521] border-b border-[#374151]">
                            <div class="px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#6B7280] text-left">Clave</div>
                            <div class="px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#6B7280] text-left">Descripcion</div>
                            <div class="px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#6B7280] text-right">Importe</div>
                        </div>
                        <div id="payRows">${rowsHtml()}</div>
                        <div class="grid grid-cols-[70px_1fr_120px] bg-[#0E1521] border-t border-[#374151]">
                            <div></div>
                            <div class="px-2.5 py-2 text-[10px] font-bold uppercase text-[#9CA3AF] text-left">Importe total</div>
                            <div class="px-2.5 py-2 text-xs font-bold text-white text-right" id="payTotal">$0.00</div>
                        </div>
                    </div>

                    <div class="bg-[#1a2332] rounded-lg p-3 border border-[#374151] flex justify-between items-center">
                        <span class="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]" id="paySaldoLbl">Saldo pendiente</span>
                        <span class="text-base font-extrabold text-[#EA0234]" id="paySaldo">${this.fmt(total)}</span>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Cobrar',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            didOpen: () => {
                const popup = Swal.getPopup();

                const recalc = () => {
                    const pagado   = methods.reduce((s, m) => s + (m.active ? (parseFloat(m.amount) || 0) : 0), 0);
                    const restante = total - pagado;
                    popup.querySelector('#payTotal').textContent = self.fmt(pagado);

                    const lbl  = popup.querySelector('#paySaldoLbl');
                    const amt  = popup.querySelector('#paySaldo');
                    if (restante > 0.009) {
                        lbl.textContent = 'Saldo pendiente';
                        amt.textContent = self.fmt(restante);
                        amt.style.color = '#EA0234';
                    } else {
                        lbl.textContent = 'Cambio a devolver';
                        amt.textContent = self.fmt(Math.abs(restante));
                        amt.style.color = '#3FC189';
                    }
                };

                const bind = () => {
                    popup.querySelectorAll('.pay-check').forEach(chk => {
                        chk.addEventListener('change', () => {
                            const m = methods.find(x => x.id == chk.dataset.mid);
                            m.active = chk.checked;
                            if (!m.active) m.amount = 0;
                            popup.querySelector('#payRows').innerHTML = rowsHtml();
                            bind();
                            recalc();
                        });
                    });
                    popup.querySelectorAll('.pay-amount').forEach(inp => {
                        inp.addEventListener('input', () => {
                            const m = methods.find(x => x.id == inp.dataset.mid);
                            m.amount = parseFloat(inp.value) || 0;
                            recalc();
                        });
                    });
                };

                bind();
                recalc();
            },
            preConfirm: () => {
                const activos = methods.filter(m => m.active && (parseFloat(m.amount) || 0) > 0);
                const pagado  = activos.reduce((s, m) => s + parseFloat(m.amount), 0);
                const cambio  = pagado - total;

                if (!activos.length) { Swal.showValidationMessage('Selecciona al menos un concepto de pago e ingresa el importe'); return false; }
                if (cambio < -0.009) { Swal.showValidationMessage('El pago no cubre el total de la venta'); return false; }
                if (cambio > 0.009 && !activos.some(m => m.is_cash)) {
                    Swal.showValidationMessage('Solo el efectivo puede generar cambio; ajusta los importes');
                    return false;
                }
                return { activos, pagado, cambio };
            }
        });

        if (!result.value) return;
        this.processPayment(result.value, total);
    }

    async processPayment({ activos, pagado, cambio }, total) {
        // El cambio se descuenta del efectivo: amount = aplicado, tendered = capturado
        const payments = activos.map(m => {
            const captured = parseFloat(m.amount);
            if (m.is_cash && cambio > 0) {
                return { type_id: m.id, amount: +(captured - cambio).toFixed(2), tendered: captured, change: +cambio.toFixed(2) };
            }
            return { type_id: m.id, amount: captured, tendered: captured, change: 0 };
        });

        const payload = {
            items: this.cart.map(it => ({ id: it.id, qty: it.qty, discount: it.discount || 0, reason_id: it.reason_id })),
            client_id: this.selectedClient?.id || null,
            note: this.ticketNote || '',
            discount: this.accountDiscount
                ? { type: this.accountDiscount.type, value: this.accountDiscount.value, reason_id: this.accountDiscount.reason_id, notes: this.accountDiscount.notes || '' }
                : null,
            payments
        };

        const res = await useFetch({ url: this._link, data: { opc: 'payVenta', payload: JSON.stringify(payload) } });

        if (res.status !== 200) {
            this.toast(res.message || 'No se pudo registrar la venta', 'error');
            return;
        }

        // Actualizar stock local y estado del turno
        this.cart.forEach(it => {
            const p = this.products.find(x => x.id == it.id);
            if (p) p.stock = Math.max(0, (Number(p.stock) || 0) - it.qty);
        });
        this.folioNum = res.folio;
        this.turno    = res.turno || this.turno;

        const resumen = payments.map(p => {
            const m = this.paymentTypes.find(t => t.id == p.type_id);
            return `<div class="flex justify-between gap-4"><span class="text-[#9CA3AF]"><b>${m?.code || ''}</b>  ${this.esc(m?.name || '')}</span><span class="text-white font-bold">${this.fmt(p.amount)}</span></div>`;
        }).join('');

        Swal.fire({
            ...this.swalBase(),
            icon: 'success',
            title: 'Venta registrada',
            html: `
                <div class="text-left text-xs space-y-1 mt-2">
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Folio</span><span class="text-white font-bold">V-${res.order_id}</span></div>
                    ${resumen}
                    <div class="flex justify-between gap-4 pt-2 mt-2 border-t border-[#374151]"><span class="text-[#9CA3AF]">Total</span><span class="text-[#3FC189] font-bold">${this.fmt(res.total)}</span></div>
                    ${res.cambio > 0 ? `<div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Cambio</span><span class="text-[#3FC189] font-bold">${this.fmt(res.cambio)}</span></div>` : ''}
                </div>
            `,
            confirmButtonText: 'Cerrar'
        });

        this.resetTicket();
        this.renderInfoHeader();
        this.renderSalesInfo();
        this.renderProducts();
    }

    //  HU-08: Cierre del día (pendiente  se hace desde pedidos) 
    openCierreModal() { this.toast('Cierre del día disponible próximamente', 'info'); }
}
