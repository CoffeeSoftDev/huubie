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
        this.id_sub          = data.id_sub          || null;
        this.rol             = data.rol             || 0;
        this.paymentTypes    = data.paymentTypes    || [];
        this.discountReasons = data.discountReasons || [];
        this.reportMode      = 'summary';
        this._selectedShiftId = null;
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
                class:     'h-[calc(100vh-3.5rem)] flex overflow-hidden',
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
                .swal2-container { z-index: 20000 !important; }
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

        // El focus-trap de Bootstrap (modales bootbox) roba el foco de cualquier
        // SweetAlert abierto encima: los inputs del Swal no reciben clicks ni teclado.
        // Se intercepta focusin en fase de captura para que Bootstrap no lo vea
        // cuando el foco va hacia un elemento dentro del SweetAlert.
        document.addEventListener('focusin', (e) => {
            if (e.target instanceof Element && e.target.closest('.swal2-container')) {
                e.stopImmediatePropagation();
            }
        }, true);
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

        $('#btnToggleTurno').on('click', () => this.turno ? this.printDailyClose() : this.openShiftModal(false));
        $('#btnCierreDay').on('click',   () => this.printDailyClose());
    }

    //  HU-08: Turno obligatorio 
    checkTurno() {
        // if (!this.turno) this.openShiftModal(true);
    }

    // Modal de apertura con bootbox (mismo patrón que pedidos): al ser un modal
    // Bootstrap, el focus-trap deja escribir en los inputs aunque esté encima
    // del modal de Cierre del Día.
    openShiftModal(blocking = false) {
        const message = `
            <div class="space-y-3">
                <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                    <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>
                    <span class="text-sm font-medium text-purple-300">${this.esc(this.sucursal || 'Sucursal')}</span>
                </div>
                ${blocking ? `<p class="text-xs text-gray-400">No hay un turno abierto. Para vender es necesario abrir uno.</p>` : ''}
                <div>
                    <label class="text-sm font-medium text-gray-300 block mb-1">Nombre del turno (opcional)</label>
                    <input id="shiftName" class="form-control bg-[#374151] border-gray-600 text-white" placeholder="Ej: Matutino, Vespertino">
                </div>
                <div>
                    <label class="text-sm font-medium text-gray-300 block mb-1">Fondo de caja inicial</label>
                    <input id="openingAmount" type="number" class="form-control bg-[#374151] border-gray-600 text-white" placeholder="0.00" min="0" step="0.01">
                </div>
                <p id="shiftError" class="text-red-400 text-xs hidden">Captura un fondo de caja válido (puede ser 0)</p>
            </div>
        `;

        const buttons = {};
        if (!blocking) {
            buttons.cancel = { label: 'Cancelar', className: 'btn-secondary' };
        }
        buttons.confirm = {
            label: 'Abrir Turno',
            className: 'btn-success',
            callback: () => {
                const raw    = $('#openingAmount').val();
                const amount = parseFloat(raw);
                if (raw === '' || isNaN(amount) || amount < 0) {
                    $('#shiftError').removeClass('hidden');
                    $('#openingAmount').addClass('!border-red-500').trigger('focus');
                    return false;
                }
                this._submitOpenShift({
                    shift_name:     ($('#shiftName').val() || '').trim(),
                    opening_amount: amount
                }, modal);
                return false; // se cierra manualmente cuando el servidor confirma
            }
        };

        const modal = bootbox.dialog({
            title: 'Abrir Turno de Caja',
            message: message,
            closeButton: !blocking,
            onEscape: !blocking,
            backdrop: blocking ? 'static' : true,
            buttons: buttons
        });

        modal.on('shown.bs.modal', () => $('#openingAmount').trigger('focus'));
    }

    async _submitOpenShift(payload, modal) {
        const res = await useFetch({ url: this._link, data: { opc: 'openShift', ...payload } });

        if (res.status === 200 || res.status === 409) {
            modal.modal('hide');
            this.turno    = res.turno;
            this.vendedor = res.vendedor || this.turno?.employee || this.vendedor;
            this.renderInfoHeader();
            this.renderSalesInfo();
            this.updateBranchDot();
            if ($('#calendarDailyClose').length) this.loadShifts();
            if (res.status === 200) this.toast('Turno abierto correctamente');
            else this.toast(res.message, 'info');
        } else {
            this.toast(res.message || 'Error al abrir el turno', 'error');
        }
    }

    // Re-sincroniza turno, stock, catálogo y folio desde el servidor
    // (tras abrir/cerrar turno o día, o al cambiar de sucursal)
    async refreshState() {
        const d = await useFetch({ url: this._link, data: { opc: 'init' } });
        this.products   = d.products || [];
        this.turno      = d.turno    || null;
        this.vendedor   = d.vendedor || '';
        this.folioNum   = d.folio    || this.folioNum;
        this.id_sub     = d.id_sub   || this.id_sub;
        this.sucursal   = d.sucursal || this.sucursal;
        this.categories = ['Todos', ...new Set(this.products.map(p => p.category || 'Sin categoría'))];
        if (!this.categories.includes(this.activeCategory)) this.activeCategory = 'Todos';
        this.searchQuery = '';

        const cli = this.selectedClient;
        this.renderInfoHeader();
        this.renderSearchBar();
        this.renderSalesInfo();
        if (cli) this.setCliente(cli);
        this.renderCart();
        this.updateTotals();
        this.renderProducts();
        this.updateBranchDot();
    }

    // Cambio de sucursal desde la navbar (Templates escucha 'branchChanged' y llama aquí).
    // La sesión ya cambió en el servidor (switchBranch), por lo que init/payVenta/openShift
    // ya operan sobre la nueva sucursal; aquí solo se re-sincroniza la vista.
    async onBranchChange(detail) {
        const hadItems = this.cart.length > 0;

        if (detail?.id)   this.id_sub   = detail.id;
        if (detail?.name) this.sucursal = detail.name;

        this.resetTicket();
        await this.refreshState();

        if (hadItems) this.toast('El ticket se vació por el cambio de sucursal', 'info');
        if (!this.turno) this.toast(`${this.sucursal}: sin turno abierto`, 'warning');
    }

    // Punto de estado de la sucursal en la navbar: verde = turno abierto, gris = cerrada
    updateBranchDot() {
        const dot = $('#btnBranch .branch-status-dot').first();
        if (!dot.length) return;
        dot.removeClass('bg-green-500 ring-green-500/20 bg-gray-400 ring-gray-400/20')
           .addClass('ring-2 ' + (this.turno ? 'bg-green-500 ring-green-500/20' : 'bg-gray-400 ring-gray-400/20'));
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  HU-08: Cierre del Día — mismo patrón que el módulo de pedidos
    // ═════════════════════════════════════════════════════════════════════════

    printDailyClose() {
        this.reportMode      = 'summary';
        this._selectedShiftId = null;

        const modalContent = `
            <div class="flex flex-col lg:flex-row gap-4" style="min-height: 480px;">
                <!-- Sidebar -->
                <div class="w-full lg:w-[280px] flex-shrink-0 space-y-4">
                    <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>
                        <span class="text-sm font-medium text-purple-300">${this.esc(this.sucursal || 'Sucursal')}</span>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Seleccionar fecha</label>
                        <input type="text" id="calendarDailyClose" class="w-full bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm cursor-pointer" readonly placeholder="Seleccionar fecha" />
                    </div>
                    <div id="openShiftsAlert" class="hidden"></div>
                    <div>
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Modo de reporte</label>
                        <div class="flex rounded-lg overflow-hidden border border-gray-600">
                            <button id="btnModeSummary" class="flex-1 py-2 text-sm font-semibold bg-purple-600 text-white" onclick="app.toggleReportMode('summary')">Resumido</button>
                            <button id="btnModeDetailed" class="flex-1 py-2 text-sm font-semibold bg-[#1a2332] text-gray-300 hover:bg-gray-700" onclick="app.toggleReportMode('detailed')">Detallado</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Seleccionar turno</label>
                        <select id="shiftSelector" class="w-full bg-[#1a2332] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" onchange="app.viewShiftPreview()">
                            <option value="">-- Seleccionar --</option>
                        </select>
                    </div>
                    <div class="space-y-2 mt-2">
                        <button id="btnOpenShift" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2" onclick="app.openShiftFromModal()">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg> Abrir Turno
                        </button>
                        <button id="btnCloseShift" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled onclick="app.closeShiftFromModal()">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Cerrar Turno
                        </button>
                        <button id="btnPrintTicket" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled onclick="app.printDailyCloseTicket()">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg> Imprimir Ticket
                        </button>
                    </div>
                    <div class="border-t border-gray-600 pt-2 mt-2 space-y-2">
                        <button id="btnCerrarDia" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled onclick="cierre.initCierre()">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Cerrar Dia
                        </button>
                    </div>
                </div>
                <!-- Ticket Preview -->
                <div class="flex-1 relative">
                    <div id="ticketPreview" class="absolute inset-0 bg-[#151d2a] rounded-lg p-4 overflow-y-auto">
                        <p class="text-xs text-gray-500 mb-2">Vista previa de impresión</p>
                        <div id="ticketContainer">
                            <div class="text-center text-gray-400 py-16">
                                <p class="mt-4">Selecciona un turno para ver el ticket</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const dialog = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <span class="text-lg font-bold text-white">Cierre del Día</span>
                </div>`,
            message: modalContent,
            size: 'large',
            closeButton: true
        });

        dialog.on('shown.bs.modal', () => {
            dataPicker({
                parent: 'calendarDailyClose',
                type: 'simple',
                rangeDefault: {
                    singleDatePicker: true,
                    showDropdowns: true,
                    autoApply: true,
                    startDate: moment(),
                    locale: { format: 'YYYY-MM-DD' }
                },
                onSelect: () => this.onDailyCloseFilterChange()
            });

            this.loadShifts();
        });
    }

    onDailyCloseFilterChange() {
        this.loadShifts();
    }

    async loadShifts() {
        const rangePicker = getDataRangePicker('calendarDailyClose');
        const date        = rangePicker.fi;

        // Limpiar badge de cierre y restaurar botón Cerrar Día (tras reapertura)
        $('.closure-badge').remove();
        const wrapper = $('.closure-wrapper');
        if (wrapper.length) {
            const label = wrapper.find('label');
            label.removeClass('!mb-0').addClass('mb-1');
            wrapper.replaceWith(label);
        }
        $('#calendarDailyClose').removeClass('!border-green-600/50');
        if (!$('#btnCerrarDia').length) {
            $('#btnReabrirDia').parent().html(`
                <button id="btnCerrarDia" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled onclick="cierre.initCierre()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Cerrar Dia
                </button>
            `);
        }

        const [response, openRes] = await Promise.all([
            useFetch({ url: this._link, data: { opc: 'getShiftsByDate', date: date, subsidiaries_id: this.id_sub } }),
            useFetch({ url: this._link, data: { opc: 'getOpenShifts', subsidiaries_id: this.id_sub } })
        ]);

        const shifts          = response.shifts || [];
        const today           = moment().format('YYYY-MM-DD');
        const allOpenShifts   = openRes.shifts || [];
        const openShifts      = allOpenShifts.filter(s => !moment(s.opened_at).isSame(today, 'day'));
        const hasAnyOpenShift = allOpenShifts.length > 0;

        const select = $('#shiftSelector');
        select.html('<option value="">-- Seleccionar turno --</option>');
        shifts.forEach(s => {
            const time  = moment(s.opened_at).format('YYYY-MM-DD hh:mm A');
            const badge = s.status === 'open' ? ' [ABIERTO]' : ' [CERRADO]';
            select.append(`<option value="${s.id}" data-status="${s.status}">${time}${badge}</option>`);
        });
        select.off('change').on('change', () => this.viewShiftPreview());

        // Turnos abiertos de otros días (alerta clickeable)
        const alertContainer = $('#openShiftsAlert');
        if (openShifts.length > 0) {
            const shiftItems = openShifts.map(s => {
                const date2 = moment(s.opened_at).format('DD/MM/YYYY');
                const time  = moment(s.opened_at).format('hh:mm A');
                const name  = s.shift_name || time;
                return `
                    <div class="flex items-center justify-between py-1.5 px-2 bg-[#1a2332] rounded-md cursor-pointer hover:bg-[#243044] transition-colors" onclick="app.selectOpenShift('${s.id}', '${moment(s.opened_at).format('YYYY-MM-DD')}')">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                            <span class="text-xs text-gray-300">${this.esc(name)}</span>
                        </div>
                        <span class="text-[10px] text-gray-500">${date2}</span>
                    </div>
                `;
            }).join('');

            alertContainer.html(`
                <div class="bg-orange-900/30 border border-orange-600/50 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2">
                        <svg class="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <span class="text-xs font-bold text-orange-400 uppercase">Turnos sin cerrar (${openShifts.length})</span>
                    </div>
                    <div class="space-y-1">${shiftItems}</div>
                </div>
            `).removeClass('hidden');
        } else {
            alertContainer.addClass('hidden').html('');
        }

        // Deshabilitar abrir turno si hay cualquier turno abierto
        if (hasAnyOpenShift) {
            $('#btnOpenShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed').removeClass('hover:bg-green-700');
        } else {
            $('#btnOpenShift').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        }

        if (shifts.length > 0) {
            select.val(shifts[0].id);
            this.viewShiftPreview();
        } else {
            $('#ticketContainer').html(`
                <div class="text-center text-gray-400 py-16">
                    <p class="mt-4">No hay turnos para esta fecha</p>
                    <p class="text-sm mt-2">Abre un turno para comenzar</p>
                </div>
            `);
            $('#btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            $('#btnPrintTicket').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        }

        // Cerrar Día solo si hay al menos un turno cerrado
        const hasClosedShifts = shifts.some(s => s.status === 'closed');
        if (hasClosedShifts) {
            $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        } else {
            $('#btnCerrarDia').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        }

        const closureCheck = await useFetch({ url: cierre.api, data: { opc: 'getCierre', date: date, subsidiaries_id: this.id_sub } });
        if (closureCheck.status === 200 && closureCheck.closure) {
            cierre.loadClosedView(date, this.id_sub);
        }
    }

    async selectOpenShift(shiftId, date) {
        const picker     = $('#calendarDailyClose').data('daterangepicker');
        const momentDate = moment(date);
        picker.setStartDate(momentDate);
        picker.setEndDate(momentDate);
        await this.loadShifts();
        $('#shiftSelector').val(shiftId).trigger('change');
    }

    openShiftFromModal() {
        this.openShiftModal(false);
    }

    async viewShiftPreview() {
        const shiftId = $('#shiftSelector').val();
        if (!shiftId) {
            $('#btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            $('#btnPrintTicket').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            return;
        }

        this._selectedShiftId = shiftId;
        const shiftStatus = $(`#shiftSelector option[value="${shiftId}"]`).data('status');

        const ticketRes = await useFetch({ url: this._link, data: { opc: 'getShiftTicket', shift_id: shiftId } });

        if (ticketRes.status !== 200) {
            $('#ticketContainer').html(`<p class="text-center text-gray-400 py-10">${ticketRes.message || 'Error al obtener datos'}</p>`);
            return;
        }

        let orders = [];
        let externalPayments = [];
        if (this.reportMode === 'detailed') {
            const ordersRes  = await useFetch({ url: this._link, data: { opc: 'getShiftOrders', shift_id: shiftId } });
            orders           = ordersRes.orders || [];
            externalPayments = ordersRes.external_payments || [];
        }

        this.ticketShiftClose({
            data:             ticketRes.data,
            shift:            ticketRes.shift,
            subsidiary_name:  ticketRes.subsidiary_name,
            logo:             ticketRes.logo,
            orders:           orders,
            externalPayments: externalPayments
        });

        $('#btnPrintTicket').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');

        if (shiftStatus === 'open') {
            $('#btnCloseShift').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        } else {
            $('#btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        }
    }

    ticketShiftClose(options) {
        const d              = options.data || {};
        const shift          = options.shift || {};
        const subsidiaryName = options.subsidiary_name || '';
        const logo           = options.logo || '';
        const orders         = options.orders || [];
        const isDetailed     = this.reportMode === 'detailed';
        const fecha          = moment(shift.opened_at).format('DD/MM/YYYY');
        const isClosed       = shift.status === 'closed';

        const closedBadge = isClosed
            ? `<div class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">CERRADO</div>
               <div class="text-[10px] text-gray-500 mt-0.5">Por: ${this.esc(shift.employee_name || 'N/A')}</div>
               <div class="text-[10px] text-gray-500">${shift.closed_at ? moment(shift.closed_at).format('DD/MM/YYYY HH:mm') : ''}</div>`
            : `<div class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">EN CURSO</div>`;

        const externalPayments = options.externalPayments || [];
        let detailedSection = '';

        if (isDetailed) {
            if (orders.length > 0) {
                const shiftTotal = orders.reduce((sum, o) => sum + parseFloat(o.total_pay || 0), 0);
                const shiftPaid  = orders.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

                const orderRows = orders.map(o => {
                    const folio = (o.order_type === 'mostrador' ? 'V-' : 'P-') + o.id;
                    return `
                        <div class="flex items-center">
                            <div class="italic truncate flex-1">${folio}</div>
                            <div class="text-right" style="width:72px">${formatPrice(o.total_pay)}</div>
                            <div class="text-right text-green-700" style="width:72px">${formatPrice(o.payment_real)}</div>
                        </div>
                        <div class="text-[10px] text-gray-500 mb-1">${this.esc(o.client_name || 'Venta directa')}</div>
                    `;
                }).join('');

                detailedSection += `
                    <div class="font-semibold mt-2 mb-1">ÓRDENES DEL TURNO</div>
                    <div class="flex text-[9px] text-gray-400 mb-0.5">
                        <span class="flex-1">FOLIO</span>
                        <span class="text-right" style="width:72px">TOTAL</span>
                        <span class="text-right" style="width:72px">COBRADO</span>
                    </div>
                    ${orderRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1">
                        <div>TOTAL ÓRDENES</div>
                        <div>${formatPrice(shiftTotal)}</div>
                    </div>
                    <div class="flex justify-between items-center text-green-700">
                        <div>COBRADO EN TURNO</div>
                        <div>${formatPrice(shiftPaid)}</div>
                    </div>
                    <hr class="border-dashed border-t my-1" />
                `;
            }

            if (externalPayments.length > 0) {
                const extTotal = externalPayments.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

                const extRows = externalPayments.map(o => `
                    <div class="flex justify-between items-center">
                        <div class="italic truncate" style="max-width:140px">P-${o.id}</div>
                        <div class="text-green-700">${formatPrice(o.payment_real)}</div>
                    </div>
                    <div class="text-[10px] text-gray-500 mb-1">${this.esc(o.client_name || 'Sin cliente')}</div>
                `).join('');

                detailedSection += `
                    <div class="font-semibold mt-2 mb-1">ABONOS DE PEDIDOS ANTERIORES</div>
                    ${extRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1 text-green-700">
                        <div>TOTAL COBRADO</div>
                        <div>${formatPrice(extTotal)}</div>
                    </div>
                    <hr class="border-dashed border-t my-1" />
                `;
            }
        }

        const totalPayments = parseFloat(d.cash_sales || 0) + parseFloat(d.card_sales || 0) + parseFloat(d.transfer_sales || 0);

        const ticketHtml = `
            <div id="layoutPrintCloseTicket" class="flex justify-center p-4">
                <div id="ticketDailyClose" class="bg-white p-4 rounded-lg shadow-lg font-mono text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%;">
                    <div class="flex flex-col items-center mb-3">
                        ${logo ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;margin-bottom:0.25rem;" class="mb-1">
                            <img src="/alpha${logo}" alt="" onerror="this.parentElement.outerHTML='<div style=\\'width:60px;height:60px;border-radius:50%;margin-bottom:0.25rem;background:#7c3aed;display:flex;align-items:center;justify-content:center;\\'><span style=\\'color:white;font-size:24px;font-weight:bold;\\'>${(subsidiaryName || 'H').charAt(0).toUpperCase()}</span></div>'" style="width:100%;height:100%;object-fit:cover;display:block;" />
                        </div>` : `<div style="width:60px;height:60px;border-radius:50%;margin-bottom:0.25rem;background:#7c3aed;display:flex;align-items:center;justify-content:center;" class="mb-1">
                            <span style="color:white;font-size:24px;font-weight:bold;">${(subsidiaryName || 'H').charAt(0).toUpperCase()}</span>
                        </div>`}
                        <h1 class="text-sm font-bold uppercase">${this.esc(subsidiaryName)}</h1>
                        <div class="text-xs font-semibold">PUNTO DE VENTA</div>
                        <div class="text-xs text-gray-600">Cierre Operativo</div>
                        ${closedBadge}
                    </div>

                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Fecha:</span><span>${fecha}</span></div>
                        <div class="flex justify-between"><span>Apertura:</span><span>${moment(shift.opened_at).format('hh:mm A')}</span></div>
                        <div class="flex justify-between"><span>Inicio de caja:</span><span>${formatPrice(shift.opening_amount || 0)}</span></div>
                        <div class="flex justify-between"><span>Sucursal:</span><span>${this.esc(subsidiaryName)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />

                    <div class="text-xs space-y-0.5">
                        ${detailedSection}

                        <div class="flex justify-between items-center">
                            <div class="font-semibold">EFECTIVO:</div>
                            <div>${parseFloat(d.cash_sales || 0) ? formatPrice(d.cash_sales) : '-'}</div>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="font-semibold">TARJETA:</div>
                            <div>${parseFloat(d.card_sales || 0) ? formatPrice(d.card_sales) : '-'}</div>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="font-semibold">TRANSFERENCIA:</div>
                            <div>${parseFloat(d.transfer_sales || 0) ? formatPrice(d.transfer_sales) : '-'}</div>
                        </div>

                        <hr class="border-dashed border-t my-1" />

                        <div class="flex justify-between items-center font-bold">
                            <div>TOTAL CAJA:</div>
                            <div class="text-sm">${totalPayments ? formatPrice(totalPayments) : '-'}</div>
                        </div>

                        <hr class="border-dashed border-t my-1" />

                        <div class="flex justify-between items-center">
                            <div class="font-semibold">ÓRDENES DEL TURNO:</div>
                            <div class="font-bold">${parseInt(d.total_orders) || '-'}</div>
                        </div>
                        <div class="mt-2"></div>
                        <div class="flex justify-between items-center">
                            <div class="font-semibold">PAGADOS:</div>
                            <div>${((d.total_orders || 0) - (d.quotation_count || 0) - (d.cancelled_count || 0) - (d.pending_count || 0)) || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="font-semibold">PENDIENTES:</div>
                            <div>${d.pending_count || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="font-semibold">COTIZACIONES:</div>
                            <div>${d.quotation_count || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="font-semibold">CANCELADOS:</div>
                            <div>${d.cancelled_count || '-'}</div>
                        </div>
                    </div>

                    <div class="text-center mt-4 text-[10px] font-bold text-gray-900 space-y-1">
                        <p>GRACIAS POR SU PREFERENCIA</p>
                        <p class="text-purple-800 text-xs">Huubie</p>
                        <p class="text-gray-500 font-normal text-[9px]">Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                    </div>
                </div>
            </div>
        `;

        $('#ticketContainer').html(ticketHtml);
    }

    toggleReportMode(mode) {
        this.reportMode = mode;

        if (mode === 'detailed') {
            $('#btnModeDetailed').addClass('bg-purple-600 text-white').removeClass('bg-[#1a2332] text-gray-300 hover:bg-gray-700');
            $('#btnModeSummary').addClass('bg-[#1a2332] text-gray-300 hover:bg-gray-700').removeClass('bg-purple-600 text-white');
        } else {
            $('#btnModeSummary').addClass('bg-purple-600 text-white').removeClass('bg-[#1a2332] text-gray-300 hover:bg-gray-700');
            $('#btnModeDetailed').addClass('bg-[#1a2332] text-gray-300 hover:bg-gray-700').removeClass('bg-purple-600 text-white');
        }

        if (this._selectedShiftId) this.viewShiftPreview();
    }

    async closeShiftFromModal() {
        const shiftId = this._selectedShiftId || $('#shiftSelector').val();
        if (!shiftId) return;

        const ordersRes  = await useFetch({ url: this._link, data: { opc: 'getShiftOrders', shift_id: shiftId } });
        const orderCount = (ordersRes.orders || []).length;

        const result = await Swal.fire({
            ...this.swalBase(),
            icon: 'question',
            title: '¿Cerrar ticket de turno?',
            html: `Se procederá a realizar el corte de caja. Se cerrarán <strong><u>${orderCount}</u></strong> tickets de venta con la información actual.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar turno',
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'huubie-swal', confirmButton: 'swal-purple' },
            focusCancel: true
        });
        if (!result.isConfirmed) return;

        const res = await useFetch({ url: this._link, data: { opc: 'closeShift', shift_id: shiftId } });

        if (res.status !== 200) {
            this.toast(res.message || 'No se pudo cerrar el turno', 'error');
            return;
        }

        this.toast('Turno cerrado correctamente');
        await this.loadShifts();
        this.refreshState();
    }

    printDailyCloseTicket() {
        const ticketContent = document.getElementById('ticketDailyClose') || document.getElementById('ticketPasteleria');

        if (!ticketContent) {
            this.toast('No hay ticket para imprimir', 'warning');
            return;
        }

        const printWindow = window.open('', '', 'height=600,width=400');
        if (!printWindow) {
            this.toast('Permite las ventanas emergentes para imprimir', 'warning');
            return;
        }
        printWindow.document.write('<html><head><title>Cierre de Turno</title>');
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
                .mt-2 { margin-top: 0.5rem; }
                .mt-1 { margin-top: 0.25rem; }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .text-\\[10px\\] { font-size: 10px; }
                .text-\\[9px\\] { font-size: 9px; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .text-gray-600 { color: #4B5563; }
                .text-gray-500 { color: #6B7280; }
                .text-purple-800 { color: #6B21A8; }
                .text-green-700 { color: #15803d; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
                .flex-1 { flex: 1; }
                .truncate { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                .space-y-1 > * + * { margin-top: 0.25rem; }
                .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
                hr { border: 0; border-top: 1px dashed #D1D5DB; margin: 0.5rem 0; }
                .border-dashed { border-style: dashed; }
                .bg-green-100, .bg-blue-100 { padding: 2px 8px; border-radius: 9999px; display: inline-block; }
                .bg-green-100 { background: #dcfce7; color: #166534; }
                .bg-blue-100 { background: #dbeafe; color: #1e40af; }
                @media print { body { padding: 0; } }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketContent.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => { printWindow.print(); }, 250);
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

    //  HU-01: Grid de productos 
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

    //  HU-02: Header del ticket + selector cliente 
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

    //  HU-02: Carrito
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

    //  HU-04: Descuentos 
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

        // Snapshot de la venta para imprimir (antes de limpiar el ticket)
        const { subtotal, descuento, iva } = this.getTotals();
        const venta = {
            order_id: res.order_id,
            fecha:    new Date().toLocaleString('es-MX'),
            items:    this.cart.map(it => {
                const p = this.products.find(x => x.id == it.id);
                return p ? { name: p.name, qty: it.qty, price: p.price, discount: it.discount || 0 } : null;
            }).filter(Boolean),
            subtotal,
            descuento,
            iva,
            total:    res.total,
            cambio:   res.cambio,
            payments: payments.map(p => {
                const m = this.paymentTypes.find(t => t.id == p.type_id);
                return { code: m?.code || '', name: m?.name || '', amount: p.amount, tendered: p.tendered, change: p.change };
            }),
            cliente:  this.selectedClient?.name || 'Público en general',
            note:     this.ticketNote || ''
        };

        this.resetTicket();
        this.renderInfoHeader();
        this.renderSalesInfo();
        this.renderProducts();

        const resumen = venta.payments.map(p =>
            `<div class="flex justify-between gap-4"><span class="text-[#9CA3AF]"><b>${p.code}</b> — ${this.esc(p.name)}</span><span class="text-white font-bold">${this.fmt(p.amount)}</span></div>`
        ).join('');

        const result = await Swal.fire({
            ...this.swalBase(),
            icon: 'success',
            title: 'Venta registrada',
            html: `
                <div class="text-left text-xs space-y-1 mt-2">
                    <div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Folio</span><span class="text-white font-bold">V-${venta.order_id}</span></div>
                    ${resumen}
                    <div class="flex justify-between gap-4 pt-2 mt-2 border-t border-[#374151]"><span class="text-[#9CA3AF]">Total</span><span class="text-[#3FC189] font-bold">${this.fmt(venta.total)}</span></div>
                    ${venta.cambio > 0 ? `<div class="flex justify-between gap-4"><span class="text-[#9CA3AF]">Cambio</span><span class="text-[#3FC189] font-bold">${this.fmt(venta.cambio)}</span></div>` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: `
                <span class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                    Imprimir ticket
                </span>
            `,
            cancelButtonText: 'Cerrar',
            customClass: { popup: 'huubie-swal', confirmButton: 'swal-green' }
        });

        if (result.isConfirmed) this.printSaleTicket(venta);
    }

    // Ticket final de la venta cobrada (folio real + formas de pago + cambio)
    printSaleTicket(venta) {
        const rows = venta.items.map(it => {
            const neto = it.price * it.qty * (1 - it.discount / 100);
            return `
                <tr>
                    <td>${this.esc(it.name)}${it.discount ? ` (-${it.discount}%)` : ''}</td>
                    <td style="text-align:center">${it.qty}</td>
                    <td style="text-align:right">${this.fmt(neto)}</td>
                </tr>
                <tr><td colspan="3" style="font-size:9px;color:#555;padding-left:8px">${it.qty} x ${this.fmt(it.price)}</td></tr>
            `;
        }).join('');

        const pagos = venta.payments.map(p => `
            <div class="tot"><span>${this.esc(p.code)} — ${this.esc(p.name)}:</span><span>${this.fmt(p.amount)}</span></div>
            ${p.change > 0 ? `<div class="tot" style="font-size:10px;color:#555"><span>Recibido: ${this.fmt(p.tendered)}</span><span>Cambio: ${this.fmt(p.change)}</span></div>` : ''}
        `).join('');

        const w = window.open('', '_blank', 'width=420,height=720');
        if (!w) { this.toast('Permite las ventanas emergentes para imprimir', 'warning'); return; }

        w.document.write(`
            <!doctype html><html><head><meta charset="utf-8"><title>Ticket V-${venta.order_id}</title>
            <style>
                body { font-family:'Courier New',monospace; font-size:11px; max-width:300px; margin:0 auto; padding:16px; color:#111; }
                h2, h3, p { margin:2px 0; text-align:center; }
                table { width:100%; border-collapse:collapse; margin:8px 0; }
                td, th { padding:2px 0; font-size:11px; }
                th { text-align:left; border-bottom:1px dashed #999; }
                .tot { display:flex; justify-content:space-between; }
                .line { border-top:1px dashed #999; margin:6px 0; }
                .big { font-size:14px; font-weight:bold; }
                .badge { display:inline-block; padding:1px 10px; border:1px solid #111; border-radius:10px; font-size:9px; font-weight:bold; }
                @media print { body { padding:0; } }
            </style></head><body>
                <h2>${this.esc(this.sucursal || 'HUUBIE')}</h2>
                <p>PUNTO DE VENTA — TICKET DE VENTA</p>
                <p><span class="badge">PAGADO</span></p>
                <div class="line"></div>
                <div class="tot"><span>Folio:</span><span><b>V-${venta.order_id}</b></span></div>
                <div class="tot"><span>Fecha:</span><span>${venta.fecha}</span></div>
                <div class="tot"><span>Cajero:</span><span>${this.esc(this.vendedor || '—')}</span></div>
                <div class="tot"><span>Cliente:</span><span>${this.esc(venta.cliente)}</span></div>
                <div class="line"></div>
                <table>
                    <tr><th>Producto</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr>
                    ${rows}
                </table>
                <div class="line"></div>
                <div class="tot"><span>Subtotal:</span><span>${this.fmt(venta.subtotal)}</span></div>
                ${venta.descuento > 0 ? `<div class="tot"><span>Descuento:</span><span>-${this.fmt(venta.descuento)}</span></div>` : ''}
                <div class="tot"><span>IVA incluido:</span><span>${this.fmt(venta.iva)}</span></div>
                <div class="tot big"><span>TOTAL:</span><span>${this.fmt(venta.total)}</span></div>
                <div class="line"></div>
                <p style="text-align:left;font-weight:bold">FORMAS DE PAGO</p>
                ${pagos}
                ${venta.cambio > 0 ? `<div class="tot big"><span>CAMBIO:</span><span>${this.fmt(venta.cambio)}</span></div>` : ''}
                ${venta.note ? `<div class="line"></div><p style="text-align:left"><b>NOTA:</b> ${this.esc(venta.note)}</p>` : ''}
                <div class="line"></div>
                <p>GRACIAS POR SU COMPRA</p>
                <p>Conserve este ticket</p>
                <p style="font-style:italic;font-weight:bold">Huubie</p>
            </body></html>
        `);
        w.document.close();
        setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
    }

}

// ═════════════════════════════════════════════════════════════════════════════
//  Cierre del Día — reutiliza el controlador compartido del módulo de pedidos
//  (mismo daily_closure / checklist / reapertura para toda la sucursal)
// ═════════════════════════════════════════════════════════════════════════════
class Cierre {
    constructor(apiUrl) {
        this.api              = apiUrl;
        this._closureData     = null;
        this._closureResponse = null;
    }

    async initCierre() {
        const rangePicker = getDataRangePicker('calendarDailyClose');
        const date        = rangePicker.fi;

        $('#btnCerrarDia').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $('#ticketContainer').html(`
            <div class="text-center text-gray-400 py-16">
                <div class="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Validando cierre...</p>
            </div>
        `);

        const data = await useFetch({ url: this.api, data: { opc: 'showCierre', date: date, subsidiaries_id: app.id_sub } });

        if (data.status !== 200) {
            $('#ticketContainer').html(`<p class="text-center text-red-400 py-10">${data.message || 'Error al validar'}</p>`);
            $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
            return;
        }

        this._closureData = data;
        this.renderChecklist(data, date, app.id_sub);
    }

    renderChecklist(data, date, subsidiaries_id) {
        const svgOk    = `<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
        const svgWarn  = `<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
        const svgBlock = `<svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;

        let checksHtml = '';
        data.checks.forEach((check, idx) => {
            if (check.ok) {
                checksHtml += `
                    <div class="flex items-center gap-3 bg-[#1a2332] rounded-lg p-3 border border-green-600/30">
                        <div class="w-7 h-7 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">${svgOk}</div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold text-white">${check.label}</p>
                            <p class="text-[11px] text-gray-500">${check.detail || ''}</p>
                        </div>
                    </div>`;
            } else if (check.blocker) {
                checksHtml += `
                    <div class="flex items-center gap-3 bg-[#1a2332] rounded-lg p-3 border border-red-600/30">
                        <div class="w-7 h-7 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">${svgBlock}</div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold text-white">${check.label}</p>
                            <p class="text-[11px] text-red-400/70">Bloquea el cierre</p>
                        </div>
                    </div>`;
            } else {
                let itemsHtml = '';
                if (check.items && check.items.length > 0) {
                    if (check.key === 'pending_balance') {
                        itemsHtml = check.items.map(item => `
                            <div class="flex items-center justify-between bg-[#151d2a] rounded-md px-3 py-2">
                                <div>
                                    <p class="text-xs font-semibold text-white">${item.folio || '-'}</p>
                                    <p class="text-[10px] text-gray-500">${item.date ? moment(item.date).format('DD/MM/YYYY hh:mm A') : ''}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs font-bold text-white">${formatPrice(item.total)}</p>
                                    <p class="text-[10px] text-red-400">Saldo: ${formatPrice(item.pending)}</p>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        itemsHtml = check.items.map(item => `
                            <div class="flex items-center justify-between bg-[#151d2a] rounded-md px-3 py-2">
                                <div>
                                    <p class="text-xs font-semibold text-white">${item.folio || item.name || '-'}</p>
                                    <p class="text-[10px] text-gray-500">${item.date ? moment(item.date).format('DD/MM/YYYY hh:mm A') : (item.opened_at ? moment(item.opened_at).format('DD/MM/YYYY hh:mm A') : '')}</p>
                                </div>
                                <span class="text-xs font-bold text-white">${item.total ? formatPrice(item.total) : (item.employee || '')}</span>
                            </div>
                        `).join('');
                    }
                }

                checksHtml += `
                    <div class="bg-[#1a2332] rounded-lg border border-yellow-600/30 overflow-hidden">
                        <div class="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#1e2a3a] transition-colors" onclick="cierre.toggleDetail('check-${idx}')">
                            <div class="w-7 h-7 rounded-full bg-yellow-600/20 flex items-center justify-center flex-shrink-0">${svgWarn}</div>
                            <div class="flex-1">
                                <p class="text-sm font-semibold text-white">${check.label}</p>
                                <p class="text-[11px] text-yellow-400/70">No bloquea el cierre</p>
                            </div>
                            <svg id="arrow-check-${idx}" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                        <div id="detail-check-${idx}" class="hidden border-t border-yellow-600/20 px-3 pb-3 pt-2 space-y-1.5">${itemsHtml}</div>
                    </div>`;
            }
        });

        const s = data.summary;
        const html = `
            <h2 class="text-base font-bold text-white mb-1">Checklist de Cierre</h2>
            <p class="text-xs text-gray-500 mb-4">${data.subsidiary_name} — ${moment(date).format('DD/MM/YYYY')}</p>
            <div class="grid grid-cols-3 gap-3 mb-3">
                <div class="bg-[#1a2332] rounded-lg p-3 text-center border border-gray-700/50">
                    <p class="text-lg font-bold text-green-400">${formatPrice(s.total_sales)}</p>
                    <p class="text-[10px] text-gray-500">Ventas</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-3 text-center border border-gray-700/50">
                    <p class="text-lg font-bold text-white">${s.total_orders}</p>
                    <p class="text-[10px] text-gray-500">Órdenes</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-3 text-center border border-gray-700/50">
                    <p class="text-lg font-bold text-white">${s.total_shifts}</p>
                    <p class="text-[10px] text-gray-500">Turnos</p>
                </div>
            </div>
            <div class="space-y-2.5 mb-6">${checksHtml}</div>
            <div class="flex gap-3">
                <button class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-700 text-white" onclick="cierre.cancelChecklist()">Cancelar</button>
                <button class="flex-1 py-2.5 rounded-lg text-sm font-semibold ${data.can_close ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 opacity-50 cursor-not-allowed'} text-white" ${data.can_close ? '' : 'disabled'} onclick="cierre.confirmClose('${date}', '${subsidiaries_id}')">Confirmar Cierre</button>
            </div>
        `;

        $('#ticketContainer').html(html);
        $('#btnOpenShift, #btnCloseShift, #btnPrintTicket').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
    }

    toggleDetail(id) {
        const detail = $(`#detail-${id}`);
        const arrow  = $(`#arrow-${id}`);
        detail.toggleClass('hidden');
        arrow.css('transform', detail.hasClass('hidden') ? '' : 'rotate(180deg)');
    }

    cancelChecklist() {
        $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        app.loadShifts();
    }

    async confirmClose(date, subsidiariesId) {
        const s = this._closureData.summary;
        const result = await Swal.fire({
            ...app.swalBase(),
            icon: 'warning',
            title: 'Confirmar Cierre Diario',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-2">Se consolidarán <strong>${s.total_shifts} turno(s)</strong> con <strong>${s.total_orders} orden(es)</strong>.</p>
                    <p class="text-gray-400 text-xs">Total del día: <strong>${formatPrice(s.total_sales)}</strong></p>
                    <p class="text-red-400 text-xs mt-2">Esta acción no se puede deshacer fácilmente.</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar día',
            cancelButtonText: 'Cancelar',
            focusCancel: true
        });

        if (!result.isConfirmed) return;

        const res = await useFetch({ url: this.api, data: { opc: 'addCierre', date: date, subsidiaries_id: subsidiariesId } });

        if (res.status === 200) {
            app.toast('Cierre diario realizado correctamente');
            await this.loadClosedView(date, subsidiariesId);
            app.refreshState();
        } else {
            app.toast(res.message || 'Error al realizar el cierre', 'error');
            this.cancelChecklist();
        }
    }

    async loadClosedView(date, subsidiariesId) {
        const res = await useFetch({ url: this.api, data: { opc: 'getCierre', date: date, subsidiaries_id: subsidiariesId } });

        if (res.status !== 200 || !res.closure) return;

        this._closureResponse = res;

        const select = $('#shiftSelector');
        select.html('');
        select.append(`<option value="daily" style="color: #f97316; font-weight: bold;">CIERRE DIARIO</option>`);
        if (res.shifts && res.shifts.length > 0) {
            res.shifts.forEach(shift => {
                const time  = moment(shift.opened_at).format('YYYY-MM-DD hh:mm A');
                const badge = shift.status === 'open' ? ' [ABIERTO]' : ' [CERRADO]';
                select.append(`<option value="${shift.id}" data-status="${shift.status}">${time}${badge}</option>`);
            });
        }
        select.off('change').on('change', function() { cierre.onShiftSelectorChange($(this).val()); });

        $('#openShiftsAlert').addClass('hidden').html('');

        // Badge de cierre junto al label de fecha
        const dateLabel = $('#calendarDailyClose').closest('div');
        dateLabel.find('.closure-badge, .closure-wrapper').remove();
        const label = dateLabel.find('label');
        label.wrap(`<div class="closure-wrapper flex items-center justify-between mb-1"></div>`);
        label.removeClass('mb-1').addClass('!mb-0');
        label.after(`<span class="closure-badge bg-green-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wide leading-none">Cerrado</span>`);
        $('#calendarDailyClose').addClass('!border-green-600/50');
        dateLabel.append(`<p class="closure-badge text-[10px] text-gray-500 mt-1">Por: <strong class="text-gray-300">${res.closure.closed_by || 'Admin'}</strong> — ${moment(res.closure.created_at).format('hh:mm A')}</p>`);

        $('#btnOpenShift, #btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $('#btnPrintTicket').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');

        const btnArea = $('#btnCerrarDia').parent();
        if (app.rol == 1) {
            btnArea.html(`
                <button id="btnReabrirDia" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2" onclick="cierre.reopenClosure(${res.closure.id})">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Reabrir Día
                </button>
                <p class="text-[9px] text-gray-600 mt-1 text-center">Solo admin — requiere motivo</p>
            `);
        } else {
            btnArea.html('');
        }

        this.renderDailyTicket(res);
    }

    renderDailyTicket(res) {
        const c = res.closure;
        const ticketAvg = c.total_orders > 0 ? (c.total_sales / c.total_orders) : 0;

        let shiftsHtml = '';
        if (res.shifts && res.shifts.length > 0) {
            shiftsHtml = res.shifts.map(shift => `
                <div class="bg-gray-50 rounded p-2 mb-1.5">
                    <div class="flex justify-between font-semibold"><span>${shift.shift_name || moment(shift.opened_at).format('hh:mm A')}</span><span>${formatPrice(shift.total_sales || 0)}</span></div>
                    <div class="text-[10px] text-gray-500">${moment(shift.opened_at).format('hh:mm A')}${shift.closed_at ? ' - ' + moment(shift.closed_at).format('hh:mm A') : ''} | ${shift.total_orders || 0} órdenes</div>
                </div>
            `).join('');
        }

        const html = `
            <div class="flex justify-center p-4">
                <div id="ticketPasteleria" class="bg-white p-5 rounded-lg shadow-lg text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; font-family: 'Courier New', monospace; font-size: 12px;">
                    <div class="flex flex-col items-center mb-3">
                        <div style="width:60px;height:60px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;" class="mb-2">
                            <span style="color:white;font-size:24px;font-weight:bold;">${(res.subsidiary_name || 'H').charAt(0).toUpperCase()}</span>
                        </div>
                        <h1 class="text-sm font-bold uppercase">${res.company_name || res.subsidiary_name || ''}</h1>
                        <div class="text-xs font-semibold">PUNTO DE VENTA</div>
                        <div class="text-xs text-gray-600 mt-0.5">Cierre Diario Consolidado</div>
                        <div class="bg-green-100 text-green-800 px-3 py-0.5 rounded-full text-[10px] font-bold mt-1.5">CERRADO</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">Por: ${c.closed_by || 'Admin'}</div>
                        <div class="text-[10px] text-gray-500">${moment(c.created_at).format('DD/MM/YYYY HH:mm')}</div>
                    </div>
                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Fecha:</span><span class="font-semibold">${moment(c.closure_date).format('DD/MM/YYYY')}</span></div>
                        <div class="flex justify-between"><span>Sucursal:</span><span>${res.subsidiary_name}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs mb-2">
                        <div class="font-bold text-center mb-1.5">RESUMEN DE TURNOS (${c.total_shifts})</div>
                        ${shiftsHtml}
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span class="font-semibold">EFECTIVO:</span><span>${formatPrice(c.total_cash)}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">TARJETA:</span><span>${formatPrice(c.total_card)}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">TRANSFERENCIA:</span><span>${formatPrice(c.total_transfer)}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs">
                        <div class="flex justify-between"><span class="font-semibold">DESCUENTOS:</span><span class="text-red-600">-${formatPrice(c.total_discount)}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="flex justify-between items-center text-sm font-bold">
                        <span>TOTAL DEL DÍA:</span>
                        <span class="text-base">${formatPrice(c.total_sales)}</span>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span class="font-semibold">TOTAL ÓRDENES:</span><span class="font-bold">${c.total_orders}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">PAGADOS:</span><span>${(c.total_orders || 0) - (res.counts.quotations || 0) - (res.counts.cancelled || 0) - (res.counts.pending || 0)}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">PENDIENTES:</span><span>${res.counts.pending}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">COTIZACIONES:</span><span>${res.counts.quotations}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">CANCELADOS:</span><span>${res.counts.cancelled}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">TICKET PROMEDIO:</span><span>${formatPrice(ticketAvg)}</span></div>
                    </div>
                    <div class="text-center mt-4 text-[10px] font-bold text-gray-900 space-y-1">
                        <p>GRACIAS POR SU PREFERENCIA</p>
                        <p class="text-purple-800 text-xs">Huubie</p>
                        <p class="text-gray-500 font-normal text-[9px]">Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                    </div>
                </div>
            </div>
        `;

        $('#ticketContainer').html(html);
    }

    onShiftSelectorChange(value) {
        if (value === 'daily') {
            this.renderDailyTicket(this._closureResponse);
        } else {
            app._selectedShiftId = value;
            app.viewShiftPreview();
        }
    }

    reopenClosure(closureId) {
        const modal = bootbox.dialog({
            title: 'Reabrir Cierre Diario',
            message: `
                <p class="text-sm text-gray-300 mb-3">Indica el motivo de la reapertura:</p>
                <textarea id="reopenReason" class="w-full bg-[#151d2a] border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-amber-500 focus:outline-none resize-none" rows="4" placeholder="Motivo de reapertura..."></textarea>
                <p id="reopenError" class="text-red-400 text-xs mt-1 hidden">Debes indicar un motivo</p>
            `,
            closeButton: true,
            buttons: {
                cancel: {
                    label: 'Cancelar',
                    className: 'btn bg-gray-600 hover:bg-gray-700 text-white border-0'
                },
                confirm: {
                    label: 'Reabrir',
                    className: 'btn bg-amber-600 hover:bg-amber-700 text-white border-0',
                    callback: () => {
                        const reason = $('#reopenReason').val();
                        if (!reason || reason.trim() === '') {
                            $('#reopenError').removeClass('hidden');
                            $('#reopenReason').addClass('!border-red-500');
                            return false;
                        }
                        this._executeReopen(closureId, reason, modal);
                        return false;
                    }
                }
            }
        });

        modal.on('shown.bs.modal', () => $('#reopenReason').focus());
    }

    async _executeReopen(closureId, reason, modal) {
        const res = await useFetch({ url: this.api, data: { opc: 'statusCierre', closure_id: closureId, reason: reason } });
        modal.modal('hide');

        if (res.status === 200) {
            app.toast('Cierre reabierto correctamente');
            app.loadShifts();
        } else {
            app.toast(res.message || 'Error al reabrir', 'error');
        }
    }
}

const cierre = new Cierre('/app/pedidos/ctrl/ctrl-cierre.php');
