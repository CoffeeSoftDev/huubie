class SaleDetailPanel {
    constructor(parent, options) {
        this.uid      = 'sdp_' + Math.random().toString(36).slice(2, 7);
        this.parent   = parent;
        this.options  = options || {};
        this.settings = null;
        this.json     = null;
    }

    buildSettings() {
        const defaults = {
            id:    this.uid,
            class: 'w-[380px] flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:  null,
            currency: 'es-MX',
            labels: {
                emptyTitle:    'Selecciona una venta',
                emptyHint:     'Haz click en cualquier fila de la tabla para ver el detalle completo aqui',
                informacion:   'Informacion',
                cliente:       'Cliente',
                fechaHora:     'Fecha y hora',
                items:         'Items - Productos',
                nota:          'Nota de la venta',
                metodosPago:   'Metodos de pago',
                subtotal:      'Subtotal',
                descuento:     'Descuento',
                total:         'Total',
                sinCliente:    'Sin cliente asociado',
                naCliente:     'N/A',
                sinNota:       'Sin nota',
                sinPagos:      'Sin pagos registrados',
                btnReabrir:    'Reabrir',
                btnReimprimir: 'Reimprimir',
                btnCancelar:   'Cancelar',
                folioPrefix:   'Venta'
            },
            sucursalLabels: {
                kafeto:     'Reginas Kafeto',
                central:    'Reginas Central',
                pasteleria: 'Reginas Pasteleria'
            },
            turnoLabels: {
                manana: 'Manana',
                tarde:  'Tarde',
                noche:  'Noche'
            },
            onClose:      () => {},
            onReabrir:    () => {},
            onReimprimir: () => {},
            onCancelar:   () => {}
        };

        const o = this.options;
        const s = Object.assign({}, defaults, o);
        s.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        s.sucursalLabels = Object.assign({}, defaults.sucursalLabels, o.sucursalLabels || {});
        s.turnoLabels    = Object.assign({}, defaults.turnoLabels,    o.turnoLabels    || {});
        return s;
    }

    init() {
        this.settings = this.buildSettings();
        this.json     = this.settings.json;
        this.render();
        this.bindEvents();
        if (this.json) this.show(this.json);
        return this;
    }

    render() {
        const s        = this.settings;
        const $aside   = $('<aside>', { id: s.id, class: s.class });
        const $empty   = this.buildEmpty(s);
        const $content = this.buildContent(s);

        $aside.append($empty, $content);
        $(this.parent).empty().append($aside);
        return this;
    }

    show(sale) {
        this.json = sale || null;
        if (!this.json) { this.clear(); return this; }
        this.renderDetail(this.json);
        $('#' + this.uid + '_empty').addClass('hidden');
        $('#' + this.uid + '_content').removeClass('hidden').addClass('flex');
        return this;
    }

    clear() {
        this.json = null;
        $('#' + this.uid + '_content').addClass('hidden').removeClass('flex');
        $('#' + this.uid + '_empty').removeClass('hidden').addClass('flex');
        return this;
    }

    buildEmpty(s) {
        return $('<div>', {
            id:    this.uid + '_empty',
            class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
        }).html(`
            <div class="w-14 h-14 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-[var(--cs-border,#374151)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
            </div>
            <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${this.esc(s.labels.emptyTitle)}</p>
            <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${this.esc(s.labels.emptyHint)}</p>
        `);
    }

    buildContent(s) {
        const $wrap = $('<div>', {
            id:    this.uid + '_content',
            class: 'hidden flex-1 flex-col overflow-hidden'
        });

        $wrap.append(`
            <div class="px-5 py-4 border-b border-[var(--cs-border,#374151)] flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <h3 class="text-base font-bold text-white" id="${this.uid}_folio">${this.esc(s.labels.folioPrefix)} —</h3>
                        <span id="${this.uid}_estatus"></span>
                    </div>
                    <button id="${this.uid}_close" class="text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-0.5" id="${this.uid}_fechaSucursal">—</p>
            </div>
        `);

        $wrap.append(`
            <div class="flex-1 overflow-y-auto cs-scroll px-5 py-4 space-y-4">
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${this.esc(s.labels.informacion)}</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-semibold mb-1">${this.esc(s.labels.cliente)}</p>
                            <div id="${this.uid}_cliente"></div>
                        </div>
                        <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-semibold mb-1">${this.esc(s.labels.fechaHora)}</p>
                            <p id="${this.uid}_fecha" class="text-[12px] text-white font-bold">—</p>
                            <p id="${this.uid}_turno" class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">—</p>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold">${this.esc(s.labels.items)}</p>
                        <span id="${this.uid}_itemsCount" class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase font-bold">0 items</span>
                    </div>
                    <div id="${this.uid}_items"></div>
                </div>

                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${this.esc(s.labels.nota)}</p>
                    <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-2.5 border border-[var(--cs-border,#374151)]">
                        <p id="${this.uid}_nota" class="text-[11px] text-[var(--cs-text-secondary,#D1D5DB)] leading-snug">—</p>
                    </div>
                </div>

                <div class="border-t border-[var(--cs-border,#374151)] pt-4">
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${this.esc(s.labels.metodosPago)}</p>
                    <div id="${this.uid}_pagos" class="space-y-1.5 mb-3"></div>

                    <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="text-[var(--cs-text-secondary,#D1D5DB)]">${this.esc(s.labels.subtotal)}</span>
                        <span id="${this.uid}_subtotal" class="text-white font-medium">$0.00</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] mb-3">
                        <span class="text-[var(--cs-text-secondary,#D1D5DB)]">${this.esc(s.labels.descuento)}</span>
                        <span id="${this.uid}_descuento" class="text-[var(--cs-warning,#FBBF24)] font-medium">-$0.00</span>
                    </div>

                    <div class="border-t border-dashed border-[var(--cs-border,#374151)] pt-3">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)] uppercase font-bold">${this.esc(s.labels.total)}</span>
                            <span id="${this.uid}_total" class="text-xl text-[var(--cs-success,#3FC189)] font-extrabold">$0.00</span>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $wrap.append(`
            <div class="px-5 py-3 border-t border-[var(--cs-border,#374151)] flex-shrink-0">
                <div class="grid grid-cols-3 gap-2">
                    <button id="${this.uid}_btnReabrir" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-border,#374151)] text-[11px] text-white hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M4 9a9 9 0 0114.85-3.36M20 20v-5h-5M20 15a9 9 0 01-14.85 3.36"/></svg>
                        ${this.esc(s.labels.btnReabrir)}
                    </button>
                    <button id="${this.uid}_btnReimprimir" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-border,#374151)] text-[11px] text-white hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                        ${this.esc(s.labels.btnReimprimir)}
                    </button>
                    <button id="${this.uid}_btnCancelar" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-danger,#E02424)]/40 text-[11px] text-[var(--cs-danger,#E02424)] hover:bg-[var(--cs-danger,#E02424)]/10 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        ${this.esc(s.labels.btnCancelar)}
                    </button>
                </div>
            </div>
        `);

        return $wrap;
    }

    renderDetail(v) {
        const s = this.settings;
        const t = this.calcTotals(v);

        $('#' + this.uid + '_folio').text(`${s.labels.folioPrefix} ${v.folio || ''}`);
        $('#' + this.uid + '_estatus').html(this.statusBadge(v.estatus));

        const sucursal = s.sucursalLabels[v.sucursal] || v.sucursal || '—';
        const turno    = s.turnoLabels[v.turno]       || v.turno    || '—';
        const estado   = v.turnoCerrado ? '(cerrado)' : '(abierto)';
        $('#' + this.uid + '_fechaSucursal').text(`${sucursal} · ${turno} ${estado}`);

        $('#' + this.uid + '_cliente').html(this.clienteHtml(v.cliente));

        const f = this.parseDate(v.fecha);
        $('#' + this.uid + '_fecha').text(f.fecha);
        $('#' + this.uid + '_turno').text(`${f.hora} · Turno: ${turno}`);

        const items = v.items || [];
        $('#' + this.uid + '_itemsCount').text(`${items.length} item${items.length === 1 ? '' : 's'}`);
        $('#' + this.uid + '_items').html(this.itemsHtml(items));

        $('#' + this.uid + '_nota').html(v.nota
            ? this.esc(v.nota)
            : `<span class="italic text-[var(--cs-text-muted,#9CA3AF)]">${this.esc(s.labels.sinNota)}</span>`);

        $('#' + this.uid + '_pagos').html(this.pagosHtml(v.pagos));

        $('#' + this.uid + '_subtotal').text(this.fmt(t.subtotal));
        $('#' + this.uid + '_descuento').text('-' + this.fmt(t.descuento));
        $('#' + this.uid + '_total').text(this.fmt(t.total));
    }

    clienteHtml(cli) {
        const s = this.settings;
        if (!cli) {
            return `<p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)] italic">${this.esc(s.labels.naCliente)}</p>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">${this.esc(s.labels.sinCliente)}</p>`;
        }
        const phone = cli.phone ? `<p class="text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]">${this.esc(cli.phone)}</p>` : '';
        const email = cli.email ? `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] truncate">${this.esc(cli.email)}</p>` : '';
        return `<p class="text-[12px] text-white font-bold leading-tight">${this.esc(cli.name)}</p>${phone}${email}`;
    }

    itemsHtml(items) {
        if (!items || items.length === 0) {
            return `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic">Sin productos</p>`;
        }
        const rows = items.map(it => {
            const bruto   = (it.price || 0) * (it.qty || 0);
            const neto    = bruto * (1 - (it.discount || 0) / 100);
            const hasDisc = (it.discount || 0) > 0;
            const bgClass = hasDisc ? 'bg-[rgba(180,160,60,0.18)]' : '';
            return `
                <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] last:border-b-0 ${bgClass}">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                            <p class="text-[13px] font-semibold text-white">${this.esc(it.name)}</p>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${it.qty} × ${this.fmt(it.price)}</span>
                                ${hasDisc ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border border-[var(--cs-warning,#FBBF24)] text-[var(--cs-warning,#FBBF24)] bg-[rgba(251,191,36,0.1)]">-${it.discount}%</span>` : ''}
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0 pt-0.5">
                            ${hasDisc ? `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] line-through">${this.fmt(bruto)}</p>` : ''}
                            <p class="text-[14px] font-bold text-white">${this.fmt(neto)}</p>
                        </div>
                    </div>
                </div>`;
        }).join('');
        return `<div class="rounded-lg border border-[var(--cs-border,#374151)] overflow-hidden">${rows}</div>`;
    }

    pagosHtml(pagos) {
        if (!pagos || pagos.length === 0) {
            return `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic">${this.esc(this.settings.labels.sinPagos)}</p>`;
        }
        return pagos.map(p => `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] bg-[var(--cs-bg-input,#1F2937)]">${this.esc(p.clave)}</span>
                    <span class="text-[11px] text-[var(--cs-text-secondary,#D1D5DB)]">${this.esc(p.name)}</span>
                </div>
                <span class="text-[11px] text-white font-semibold">${this.fmt(p.amount)}</span>
            </div>
        `).join('');
    }

    statusBadge(estatus) {
        const v = String(estatus || '').toLowerCase();
        const map = {
            pagado:    { bg: 'rgba(63,193,137,0.18)', fg: 'var(--cs-success,#3FC189)', txt: 'PAGADO' },
            cancelado: { bg: 'rgba(224,36,36,0.18)',  fg: 'var(--cs-danger,#E02424)',  txt: 'CANCELADO' },
            abierto:   { bg: 'rgba(28,100,242,0.18)', fg: 'var(--cs-info,#1C64F2)',    txt: 'ABIERTO' }
        };
        const c = map[v] || { bg: 'rgba(251,191,36,0.18)', fg: 'var(--cs-warning,#FBBF24)', txt: this.esc(estatus).toUpperCase() };
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide" style="background:${c.bg};color:${c.fg};">${c.txt}</span>`;
    }

    bindEvents() {
        const s = this.settings;
        $('#' + this.uid + '_close').off('click').on('click', () => {
            this.clear();
            s.onClose(this);
        });
        $('#' + this.uid + '_btnReabrir').off('click').on('click',    () => s.onReabrir(this.json, this));
        $('#' + this.uid + '_btnReimprimir').off('click').on('click', () => s.onReimprimir(this.json, this));
        $('#' + this.uid + '_btnCancelar').off('click').on('click',   () => s.onCancelar(this.json, this));
    }

    calcTotals(v) {
        const items = v.items || [];
        const subtotal  = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0), 0);
        const descuento = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0) * ((it.discount || 0) / 100), 0);
        return { subtotal, descuento, total: subtotal - descuento };
    }

    parseDate(iso) {
        if (!iso) return { fecha: '—', hora: '—' };
        const d  = new Date(iso);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return { fecha: `${dd}/${mm}/${yy}`, hora: `${hh}:${mi}` };
    }

    fmt(n) {
        return '$' + parseFloat(n || 0).toLocaleString(this.settings.currency, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
