class FacturadorView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
        this.ticketFmt    = 'wansoft';
    }

    esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    renderHeader(meta, extra) {
        $('#viewHeader').html(`
            <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style="background:linear-gradient(135deg,#C05A40 0%,#E8A68F 100%);">
                    <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                </span>
                <div>
                    <h1 class="text-base font-bold text-gray-800">${this.esc(meta.title)}</h1>
                    <p class="text-[11px] text-gray-500">${this.esc(meta.subtitle)}</p>
                </div>
            </div>
            ${extra || ''}
        `);
    }

    card(inner, cls) {
        return `<div class="bg-white rounded-lg border border-gray-200 overflow-hidden ${cls || ''}">${inner}</div>`;
    }

    foliosShell(meta) {
        this.renderHeader(meta);

        const note = `
            <div class="px-4 py-2 border-b border-gray-100 flex items-center gap-3">
                <p class="text-[10px] text-gray-400">todos los tickets del periodo &middot; se omiten efectivos no facturados &middot; los facturados quedan congelados con CFDI vigente</p>
                <span id="foliosCount" class="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:#F7F0EB;color:#A84A33;border:1px solid #F0C4B5;">0 tickets</span>
            </div>`;

        const main = `
            <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
                ${note}
                <div id="foliosTable" class="p-3 flex-1 min-h-0 overflow-auto bg-white"></div>
            </div>`;

        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full flex flex-col overflow-hidden">${main}</div>`);
        if (window.lucide) lucide.createIcons();
    }

    resumenShell(meta) {
        this.renderHeader(meta);

        const kpi = (label, valId, tone, icon, det) => `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">${label}</span>
                    <i data-lucide="${icon}" class="w-4 h-4 ${tone.icon}"></i>
                </div>
                <p class="text-xl font-extrabold ${tone.val}" id="${valId}">$0.00</p>
                <p class="text-[10px] text-gray-400 mt-1" id="${valId}Det">${det || ''}</p>
            </div>`;

        const kpis = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                ${kpi('Venta total del periodo', 'rzVenta',      { icon: 'text-gray-400',   val: 'text-gray-900' }, 'banknote', '0 tickets')}
                ${kpi('Meta al 70%',             'rzMeta',       { icon: 'text-[#C05A40]',  val: 'text-gray-900' }, 'target', 'gravado al 16%')}
                ${kpi('Monto facturado',         'rzFacturado',  { icon: 'text-green-600',  val: 'text-green-700' }, 'lock', '0 órdenes bloqueadas')}
                ${kpi('Por facturar al 16%',     'rzPorFacturar',{ icon: 'text-amber-500',  val: 'text-[#C05A40]' }, 'alert-circle', '= meta − facturado')}
            </div>`;

        const progress = `
            <div class="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-semibold text-gray-700">Avance de la meta de facturación</span>
                    <span class="text-[11px] font-bold text-[#C05A40]" id="rzAvancePct">0%</span>
                </div>
                <div style="height:10px;border-radius:9999px;background:#E5E7EB;overflow:hidden">
                    <div id="rzAvanceBar" style="height:100%;border-radius:9999px;background:linear-gradient(90deg,#C05A40,#E08A70);width:0%;transition:width .5s ease"></div>
                </div>
                <div class="flex justify-between mt-2 text-[10px] text-gray-400">
                    <span id="rzAvanceFact">$0.00 facturado</span>
                    <span id="rzAvanceObj">objetivo $0.00</span>
                </div>
            </div>`;

        const tables = `
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                ${this.card(`<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="sigma" class="w-4 h-4 text-gray-400"></i>Acumulado total real</h3><span class="badge-base b-gray">todos los pagos</span></div><div id="tblAcumulado" class="p-2 max-h-80 overflow-auto"></div>`)}
                ${this.card(`<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="file-clock" class="w-4 h-4 text-amber-500"></i>No facturado que voy a facturar</h3><span class="badge-base b-yellow">solo tarjeta</span></div><div id="tblPending" class="p-2 max-h-80 overflow-auto"></div>`)}
                ${this.card(`<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="lock" class="w-4 h-4 text-green-600"></i>Orden facturado</h3><span class="badge-base b-green">bloqueadas</span></div><div id="tblFacturado" class="p-2 max-h-80 overflow-auto"></div>`)}
            </div>`;

        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto"><div class="p-4">${kpis}${progress}${tables}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillResumenKpis(st) {
        $('#rzVenta').text(_money(st.totalReal));
        $('#rzVentaDet').text(`${st.ticketsCount} tickets · efectivo + tarjeta`);
        $('#rzMeta').text(_money(st.meta));
        $('#rzFacturado').text(_money(st.totalFact));
        $('#rzFacturadoDet').text(`${st.facturadasCount} órdenes bloqueadas (CFDI vigente)`);
        $('#rzPorFacturar').text(_money(st.aFacturar));
        const pct = Math.min(100, st.logrado || 0);
        $('#rzAvancePct').text(pct.toFixed(1) + '%');
        $('#rzAvanceBar').css('width', pct + '%');
        $('#rzAvanceFact').text(`${_money(st.totalFact)} facturado`);
        $('#rzAvanceObj').text(`objetivo ${_money(st.meta)}`);
    }

    uploadZone(tone, title, hint, badgeId, badgeCls) {
        return `
            <div class="mb-4 flex items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-4 cursor-pointer hover:border-[#C05A40]" onclick="facturadorView.fakeUpload()">
                <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style="background:${tone.bg}"><i data-lucide="file-spreadsheet" class="w-5 h-5" style="color:${tone.fg}"></i></div>
                <div class="flex-1">
                    <p class="text-[12px] font-semibold text-gray-800">${title}</p>
                    <p class="text-[10px] text-gray-500 mt-0.5">${hint}</p>
                </div>
                <span id="${badgeId}" class="badge-base ${badgeCls}">Pendiente</span>
            </div>`;
    }

    ventasShell(meta) {
        this.renderHeader(meta);

        const zone = this.uploadZone({ bg: '#F5E3DC', fg: '#C05A40' }, 'Arrastra aquí el export del POS (hoja "Venta por pago")', 'Modo demo · los datos provienen del sample sembrado.', 'vBadge', 'b-gray');
        const kpis = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Pagos</p><p class="text-lg font-extrabold text-gray-900" id="vpPagos">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Órdenes</p><p class="text-lg font-extrabold text-gray-900" id="vpOrdenes">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Tarjeta de crédito</p><p class="text-lg font-extrabold text-[#C05A40]" id="vpTarjeta">$0.00</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Efectivo</p><p class="text-lg font-extrabold text-green-700" id="vpEfectivo">$0.00</p></div>
            </div>`;
        const table = this.card(`<div id="ventasTable" class="p-2 overflow-auto max-h-[520px]"></div><div class="px-4 py-3 border-t border-gray-100"><p class="text-[10px] text-gray-500" id="vpFoot">0 pagos</p></div>`);
        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto"><div class="p-4">${zone}${kpis}${table}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillVentasKpis(d) {
        $('#vpPagos').text(d.pagos);
        $('#vpOrdenes').text(d.ordenes);
        $('#vpTarjeta').text(_money(d.tarjeta));
        $('#vpEfectivo').text(_money(d.efectivo));
        $('#vpFoot').text(d.foot);
    }

    detalladoShell(meta) {
        this.renderHeader(meta);

        const zone = this.uploadZone({ bg: '#FEF3C7', fg: '#D97706' }, 'Arrastra aquí el export detallado del POS (hoja "Detallado")', 'Modo demo · las celdas sin dato se marcan como NULL.', 'dBadge', 'b-yellow');
        const table = this.card(`<div id="detalladoTable" class="p-2 overflow-auto max-h-[540px]"></div><div class="px-4 py-3 border-t border-gray-100"><p class="text-[10px] text-gray-500" id="detFoot">0 renglones</p></div>`);
        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto"><div class="p-4">${zone}${table}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    facturasShell(meta) {
        this.renderHeader(meta);

        const zone = this.uploadZone({ bg: '#F5E3DC', fg: '#C05A40' }, 'Arrastra aquí la lista de facturas (hoja "Facturados")', 'Modo demo · CFDI provenientes del sample sembrado.', 'fBadge', 'b-gray');
        const kpis = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Facturas</p><p class="text-lg font-extrabold text-gray-900" id="fcTotal">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Vigentes</p><p class="text-lg font-extrabold text-green-700" id="fcVigentes">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Canceladas</p><p class="text-lg font-extrabold text-red-600" id="fcCanceladas">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Monto facturado</p><p class="text-lg font-extrabold text-[#C05A40]" id="fcMonto">$0.00</p></div>
            </div>`;
        const table = this.card(`<div id="facturasTable" class="p-2 overflow-auto max-h-[520px]"></div><div class="px-4 py-3 border-t border-gray-100"><p class="text-[10px] text-gray-500" id="fcFoot">0 facturas</p></div>`);
        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto"><div class="p-4">${zone}${kpis}${table}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillFacturasKpis(d) {
        $('#fcTotal').text(d.total);
        $('#fcVigentes').text(d.vigentes);
        $('#fcCanceladas').text(d.canceladas);
        $('#fcMonto').text(_money(d.monto));
        $('#fcFoot').text(d.foot);
    }

    catalogosShell(meta) {
        this.renderHeader(meta);

        const bridge = this.card(`
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="utensils" class="w-4 h-4 text-[#C05A40]"></i>Productos puente</h3>
                <button class="ct-add" onclick="facturadorView.openBridgeForm()"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo</button>
            </div>
            <div id="bridgeTable" class="p-2 max-h-96 overflow-auto"></div>`);

        const customers = this.card(`
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="users" class="w-4 h-4 text-[#C05A40]"></i>Clientes fiscales</h3>
                <button class="ct-add" onclick="facturadorView.openCustomerForm()"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo</button>
            </div>
            <div id="customersTable" class="p-2 max-h-96 overflow-auto"></div>`);

        const params = `
            <div class="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
                <h3 class="text-[12px] font-bold text-gray-800 mb-3 flex items-center gap-2"><i data-lucide="settings-2" class="w-4 h-4 text-[#C05A40]"></i>Parámetros de facturación</h3>
                <div class="flex flex-wrap items-end gap-4">
                    <div><label class="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Porcentaje de meta</label><input type="number" step="0.01" min="0" max="1" id="paramPct" class="rounded-lg border border-gray-200 px-3 py-2 text-sm w-28"></div>
                    <div><label class="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Tasa de IVA</label><input type="number" step="0.01" min="0" max="1" id="paramIva" class="rounded-lg border border-gray-200 px-3 py-2 text-sm w-28"></div>
                    <button class="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg" style="background:#C05A40" onclick="facturador.saveParams(parseFloat($('#paramPct').val()), parseFloat($('#paramIva').val()))"><i data-lucide="save" class="w-4 h-4"></i>Guardar</button>
                </div>
            </div>`;

        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto"><div class="p-4"><div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${bridge}${customers}${params}</div></div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillParams(meta) {
        $('#paramPct').val(meta.porcentaje);
        $('#paramIva').val(meta.tasaIva);
    }

    setFoot(id, text) {
        $('#' + id).text(text);
    }

    fakeUpload() {
        this.alertBox({ type: 'info', title: 'Modo demo', text: 'La carga de Excel se conecta al backend real. Aquí los datos vienen del sample sembrado.', timer: 2200 });
    }

    resumenPanel(options) {
        const opts = Object.assign({ parent: 'detailPanel', json: {}, period: {}, onConfig: () => {} }, options || {});
        const st  = opts.json;
        const pctFact  = Math.round((st.pct || 0.70) * 100);
        const pctCero  = 100 - pctFact;

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        $parent.html(`
            <div class="flex items-center gap-2 mb-1">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-[#C05A40]"></i>
                <h3 class="text-[11px] font-bold text-gray-800">Resumen de facturación</h3>
                <button id="resumenConfigBtn" class="ml-auto text-gray-400 hover:text-[#C05A40]" title="Configurar porcentaje">
                    <i data-lucide="settings" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <p class="text-[9px] text-gray-400 mb-2">${opts.period.chip || ''} &middot; ${opts.period.label || ''}</p>

            <div class="flex flex-col gap-2">
                <div class="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Cuenta total</span>
                        <span class="text-[9px] font-extrabold text-gray-500">100%</span>
                    </div>
                    <p class="text-base font-extrabold text-gray-900 leading-tight">${_money(st.totalReal)}</p>
                    <p class="text-[8px] text-gray-400 leading-tight">${st.ticketsCount || 0} tickets &middot; todos los pagos</p>
                </div>

                <div class="rounded-md px-2.5 py-2" style="background:#FBF1ED;border:1px solid #F5E3DC;">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Meta a facturar 16%</span>
                        <span class="text-[9px] font-extrabold text-[#C05A40]">${pctFact}%</span>
                    </div>
                    <p class="text-base font-extrabold text-[#C05A40] leading-tight">${_money(st.meta)}</p>
                    <p class="text-[8px] text-gray-400 leading-tight">parte del total que se factura con IVA</p>
                </div>

                <div class="ml-2 pl-2 flex flex-col gap-2" style="border-left:2px solid #F0C4B5;">
                    <div class="rounded-md bg-green-50 border border-green-100 px-2.5 py-2">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Ya facturado</span>
                        <p class="text-base font-extrabold text-green-700 leading-tight">${_money(st.totalFact)}</p>
                        <p class="text-[8px] text-gray-400 leading-tight">${st.facturadasCount || 0} órdenes bloqueadas &middot; ${(st.logrado || 0).toFixed(1)}% logrado</p>
                    </div>
                    <div class="rounded-md px-2.5 py-2" style="background:#FBF1ED;border:1px solid #F0C4B5;">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Falta por facturar</span>
                        <p class="text-base font-extrabold text-[#A84A33] leading-tight">${_money(st.aFacturar)}</p>
                        <p class="text-[8px] text-gray-400 leading-tight">= meta - ya facturado</p>
                    </div>
                </div>

                <div class="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Se queda en 0%</span>
                        <span class="text-[9px] font-extrabold text-gray-500">${pctCero}%</span>
                    </div>
                    <p class="text-base font-extrabold text-gray-900 leading-tight">${_money(st.cero)}</p>
                    <p class="text-[8px] text-gray-400 leading-tight">resto del total &middot; no se factura</p>
                </div>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
        $parent.find('#resumenConfigBtn').on('click', () => opts.onConfig());
    }

    openPctConfig() {
        const modal = this.cfModal({
            title:   'Porcentaje de facturación',
            theme:   'light',
            size:    'small',
            okLabel: 'Guardar',
            onOk:    () => { if (this.pctFormEl) this.pctFormEl.trigger('submit'); }
        });

        const host = $('<div>', { id: 'pctConfigHost' });
        modal.body.append(host);

        this.pctFormEl = this.coffeeForm({
            parent:  'pctConfigHost',
            id:      'pctConfigForm',
            Element: 'form',
            theme:   'light',
            json: [
                { opc: 'input', type: 'number', tipo: 'numero', id: 'cfgPct', name: 'porcentaje', lbl: 'Porcentaje que se factura al 16% (el resto queda en 0%)', class: 'col-12', value: Math.round((SAMPLE_FACTURADOR_META.porcentaje || 0.70) * 100), required: true }
            ],
            onSave: (d) => {
                const v = parseFloat(d.porcentaje);
                if (isNaN(v) || v < 0 || v > 100) {
                    this.alertBox({ type: 'error', title: 'Porcentaje inválido (0 a 100)' });
                    return;
                }
                facturador.setMetaPct(v);
                modal.close();
                this.alertBox({ type: 'success', title: `Porcentaje de facturación: ${Math.round(v)}%`, timer: 1400 });
            }
        });
    }

    openBridgeForm(id) {
        const p = id ? SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.find(x => x.id === id) : null;
        const modal = this.cfModal({ title: p ? 'Editar producto puente' : 'Nuevo producto puente', theme: 'light', size: 'default', okLabel: 'Guardar', onOk: () => { if (this.bridgeFormEl) this.bridgeFormEl.trigger('submit'); } });
        const host = $('<div>', { id: 'bridgeFormHost' });
        modal.body.append(host);
        this.bridgeFormEl = this.coffeeForm({
            parent: 'bridgeFormHost', id: 'bridgeForm', Element: 'form', theme: 'light',
            json: [
                { opc: 'input', type: 'text',   tipo: 'texto',  id: 'bClave',  name: 'clave',  lbl: 'Clave',              class: 'col-6', value: p ? p.clave : '', required: true },
                { opc: 'input', type: 'number', tipo: 'numero', id: 'bPrecio', name: 'price',  lbl: 'Precio',             class: 'col-6', value: p ? p.price : '', required: true },
                { opc: 'input', type: 'text',   tipo: 'texto',  id: 'bName',   name: 'name',   lbl: 'Platillo / Artículo', class: 'col-12', value: p ? p.name : '', required: true }
            ],
            onSave: (d) => { d.id = id || ''; facturador.saveBridge(d); modal.close(); }
        });
    }

    openCustomerForm(id) {
        const c = id ? SAMPLE_FACTURADOR_CUSTOMERS.find(x => x.id === id) : null;
        const modal = this.cfModal({ title: c ? 'Editar cliente fiscal' : 'Nuevo cliente fiscal', theme: 'light', size: 'default', okLabel: 'Guardar', onOk: () => { if (this.custFormEl) this.custFormEl.trigger('submit'); } });
        const host = $('<div>', { id: 'custFormHost' });
        modal.body.append(host);
        this.custFormEl = this.coffeeForm({
            parent: 'custFormHost', id: 'custForm', Element: 'form', theme: 'light',
            json: [
                { opc: 'input', type: 'text', tipo: 'texto', id: 'cRfc',  name: 'rfc',  lbl: 'RFC',          class: 'col-12', value: c ? c.rfc : '', required: true },
                { opc: 'input', type: 'text', tipo: 'texto', id: 'cName', name: 'name', lbl: 'Razón social', class: 'col-12', value: c ? c.name : '', required: true }
            ],
            onSave: (d) => { d.id = id || ''; facturador.saveCustomer(d); modal.close(); }
        });
    }

    openTicket(saleId) {
        const ticket = facturador.getTicket(saleId);
        if (!ticket) {
            this.alertBox({ type: 'error', title: 'No se pudo generar el ticket virtual' });
            return;
        }
        this.ticketModal({
            json:    ticket,
            tasa:    facturador.tasaDeVenta(saleId),
            fmt:     this.ticketFmt,
            onSwap:  (fmt) => { this.ticketFmt = fmt; },
            onRegen: () => facturador.getTicket(saleId),
            onPrint: (t) => this.openPrintSelector(t)
        });
    }

    buildTicketHtml(t, fmt) {
        const esc = (s) => this.esc(s);
        const sep = '<div style="border-top:1px dashed #9CA3AF;margin:8px 0;"></div>';

        if (fmt === 'softrestaurant') {
            const items = t.items.map(it => `<tr><td>${it.qty}&nbsp;&nbsp;${esc(it.name)}</td><td style="text-align:right">${_money(it.qty * it.price)}</td></tr>`).join('');
            const disc  = t.discount > 0 ? `<tr><td>DESCUENTO:</td><td style="text-align:right;color:#9D3434">-${_money(t.discount)}</td></tr>` : '';
            const iva   = t.total - t.total / (1 + (SAMPLE_FACTURADOR_META.tasaIva || 0.16));
            return `
                <div style="text-align:center">
                    <p style="font-weight:700;font-size:13px;letter-spacing:1px">RESTAURANT</p>
                    <p>Av. Central Norte 45, Tapachula, Chis.</p>
                    <p>Tel. (962) 555-0134</p>
                </div>${sep}
                <table>
                    <tr><td>CHEQUE:</td><td style="text-align:right;font-weight:700">#${esc(t.nota)}</td></tr>
                    <tr><td>FECHA:</td><td style="text-align:right">${_fmtDate(t.date)}</td></tr>
                    <tr><td>MESA:</td><td style="text-align:right">${esc(t.mesa || '-')}</td></tr>
                    <tr><td>LE ATENDIO:</td><td style="text-align:right">${esc(t.mesero || '-')}</td></tr>
                    <tr><td>ESTACION:</td><td style="text-align:right">${esc(t.terminal || '-')}</td></tr>
                </table>${sep}
                <table>
                    <tr><td style="font-weight:700">CANT DESCRIPCION</td><td style="text-align:right;font-weight:700">IMPORTE</td></tr>
                    ${items}
                </table>${sep}
                <table>
                    <tr><td>SUBTOTAL:</td><td style="text-align:right">${_money(t.subtotal)}</td></tr>
                    ${disc}
                    <tr><td style="font-weight:700;font-size:13px">TOTAL:</td><td style="text-align:right;font-weight:700;font-size:13px">${_money(t.total)}</td></tr>
                    <tr><td>IVA INCLUIDO:</td><td style="text-align:right">${_money(iva)}</td></tr>
                </table>${sep}
                <div style="text-align:center">
                    <p>FORMA DE PAGO: ${esc(t.paymentForm)}</p>
                    <p style="margin-top:4px">PROPINA NO INCLUIDA</p>
                    <p style="margin-top:6px">GRACIAS POR SU VISITA</p>
                    <p style="margin-top:6px;color:#6B7280">Este ticket no es un comprobante fiscal</p>
                    <p style="margin-top:4px;color:#6B7280;font-size:10px">SoftRestaurant</p>
                </div>`;
        }

        const items = t.items.map(it => `<tr><td style="text-align:center">${it.qty}</td><td>${esc(it.name)}</td><td style="text-align:right">${_money(it.price)}</td><td style="text-align:right">${_money(it.qty * it.price)}</td></tr>`).join('');
        const disc  = t.discount > 0 ? `<tr><td colspan="3">Descuento:</td><td style="text-align:right;color:#9D3434">-${_money(t.discount)}</td></tr>` : '';
        return `
            <div style="text-align:center">
                <p style="font-weight:700;font-size:13px;letter-spacing:1px">RESTAURANT</p>
                <p>Av. Central Norte 45, Tapachula, Chis.</p>
                <p>Tel. (962) 555-0134</p>
            </div>${sep}
            <p style="text-align:center;font-weight:700;font-size:13px">CUENTA #${esc(t.nota)}</p>
            <table>
                <tr><td>Fecha:</td><td style="text-align:right">${_fmtDate(t.date)}</td></tr>
                <tr><td>Terminal:</td><td style="text-align:right">${esc(t.terminal || '-')}</td></tr>
                <tr><td>Mesa:</td><td style="text-align:right">${esc(t.mesa || '-')}</td></tr>
                <tr><td>Atendio:</td><td style="text-align:right">${esc(t.mesero || '-')}</td></tr>
            </table>${sep}
            <table>
                <tr><td style="font-weight:700;text-align:center">Cant</td><td style="font-weight:700">Producto</td><td style="font-weight:700;text-align:right">Precio</td><td style="font-weight:700;text-align:right">Total</td></tr>
                ${items}
            </table>${sep}
            <table>
                <tr><td colspan="3">Subtotal:</td><td style="text-align:right">${_money(t.subtotal)}</td></tr>
                ${disc}
                <tr><td colspan="3" style="font-weight:700;font-size:13px">Total:</td><td style="text-align:right;font-weight:700;font-size:13px">${_money(t.total)}</td></tr>
            </table>${sep}
            <div style="text-align:center">
                <p>Forma de pago: ${esc(t.paymentForm)}</p>
                <p style="margin-top:6px">Gracias por su preferencia</p>
                <p style="margin-top:6px;color:#6B7280">Documento sin valor fiscal</p>
                <p style="margin-top:4px;color:#6B7280;font-size:10px">Powered by Wansoft</p>
            </div>`;
    }

    ticketModal(options) {
        const opts = Object.assign({ json: null, tasa: '', fmt: 'wansoft', onSwap: () => {}, onRegen: () => null, onPrint: () => {} }, options || {});
        let ticket = opts.json;
        let fmt    = opts.fmt;
        if (!ticket) return;

        $('#facturadorTicketModal').remove();

        const paperStyle = "background:#fff;border:1px solid #E5E7EB;border-radius:10px;font-family:'Courier New',ui-monospace,monospace;font-size:11px;color:#1F2937;padding:22px 20px;max-width:320px;margin:0 auto;line-height:1.5;";

        const overlay = $('<div>', {
            id: 'facturadorTicketModal',
            style: 'position:fixed;inset:0;background:rgba(17,25,40,.5);z-index:60;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px;'
        });

        const regenBtn = opts.tasa === '0%'
            ? `<button id="ticketRegen" class="flex items-center gap-1.5 text-xs font-semibold" style="background:#fff;color:#374151;border:1px solid #E5E7EB;padding:8px 12px;border-radius:8px;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Regenerar productos</button>`
            : '';

        overlay.html(`
            <div style="background:#fff;border-radius:14px;max-width:420px;width:100%;margin:auto;box-shadow:0 12px 40px rgba(17,25,40,.25);">
                <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid #F3F4F6;">
                    <div class="flex items-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4 text-[#C05A40]"></i>
                        <h3 class="text-sm font-bold text-gray-800">Ticket virtual <span id="ticketModalOrden" class="text-[#C05A40]"></span></h3>
                    </div>
                    <button id="ticketModalClose" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="flex justify-center" style="padding:10px 18px 0;">
                    <button id="ticketSwap" class="flex items-center gap-1.5 text-xs font-semibold" style="background:#fff;color:#374151;border:1px solid #E5E7EB;padding:6px 14px;border-radius:8px;">
                        <i data-lucide="repeat" class="w-3.5 h-3.5"></i><span id="ticketSwapLabel"></span>
                    </button>
                </div>
                <div style="padding:14px 18px;max-height:56vh;overflow:auto;background:#FAFCFF;">
                    <div id="ticketPaper" style="${paperStyle}"></div>
                </div>
                <div class="flex items-center justify-center gap-2" style="padding:12px 18px;border-top:1px solid #F3F4F6;background:#FAFCFF;border-radius:0 0 14px 14px;">
                    ${regenBtn}
                    <button id="ticketPrint" class="flex items-center gap-1.5 text-xs font-semibold text-white" style="background:#C05A40;padding:8px 16px;border-radius:8px;">
                        <i data-lucide="printer" class="w-3.5 h-3.5"></i>Imprimir
                    </button>
                </div>
            </div>
        `);

        $('body').append(overlay);

        const paint = () => {
            overlay.find('#ticketModalOrden').text('#' + ticket.nota);
            overlay.find('#ticketPaper').html(this.buildTicketHtml(ticket, fmt));
            overlay.find('#ticketSwapLabel').text(fmt === 'wansoft' ? 'Cambiar a SoftRestaurant' : 'Cambiar a Wansoft');
            if (window.lucide) lucide.createIcons();
        };

        paint();

        overlay.on('click', '#ticketModalClose', () => overlay.remove());
        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) overlay.remove(); });
        overlay.on('click', '#ticketSwap', () => { fmt = (fmt === 'wansoft') ? 'softrestaurant' : 'wansoft'; opts.onSwap(fmt); paint(); });
        overlay.on('click', '#ticketRegen', () => { const t = opts.onRegen(); if (t) { ticket = t; paint(); } });
        overlay.on('click', '#ticketPrint', () => opts.onPrint(ticket, fmt));
    }

    openPrintSelector(ticket) {
        $('#facturadorPrintSelector').remove();
        const overlay = $('<div>', {
            id: 'facturadorPrintSelector',
            style: 'position:fixed;inset:0;background:rgba(17,25,40,.55);z-index:70;display:flex;align-items:center;justify-content:center;padding:24px;'
        });
        const cardStyle = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 12px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;color:#374151;';
        overlay.html(`
            <div style="background:#fff;border-radius:14px;max-width:400px;width:100%;box-shadow:0 12px 40px rgba(17,25,40,.25);">
                <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid #F3F4F6;">
                    <h3 class="text-sm font-bold text-gray-800 flex items-center gap-2"><i data-lucide="printer" class="w-4 h-4 text-[#C05A40]"></i>¿De qué sistema deseas generar el ticket?</h3>
                    <button id="psClose" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div style="padding:18px;">
                    <div class="grid grid-cols-2 gap-3">
                        <button id="psSoft" style="${cardStyle}"><i data-lucide="utensils" class="w-6 h-6 text-[#C05A40]"></i>SoftRestaurant<span style="font-size:10px;font-weight:400;color:#9CA3AF">Formato cheque de consumo</span></button>
                        <button id="psWan" style="${cardStyle}"><i data-lucide="monitor-smartphone" class="w-6 h-6 text-[#C05A40]"></i>Wansoft<span style="font-size:10px;font-weight:400;color:#9CA3AF">Formato cuenta de venta</span></button>
                    </div>
                </div>
            </div>
        `);
        $('body').append(overlay);
        if (window.lucide) lucide.createIcons();

        const choose = (fmt) => {
            this.ticketFmt = fmt;
            overlay.remove();
            this.printTicketDoc(ticket, fmt);
        };
        overlay.on('click', '#psClose', () => overlay.remove());
        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) overlay.remove(); });
        overlay.on('click', '#psSoft', () => choose('softrestaurant'));
        overlay.on('click', '#psWan', () => choose('wansoft'));
    }

    printTicketDoc(t, fmt) {
        const inner = this.buildTicketHtml(t, fmt);
        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket #${t.nota}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',ui-monospace,monospace;background:#c8c8c8;padding:24px}.toolbar{max-width:320px;margin:0 auto 14px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:700;color:#fff;background:#C05A40;font-family:'Inter',sans-serif}.btn.gray{background:#777}.paper{background:#fff;max-width:320px;margin:0 auto;padding:22px 20px;font-size:11px;color:#1F2937;line-height:1.5;box-shadow:0 2px 10px rgba(0,0,0,.25)}.paper table{width:100%}.paper td{padding:2px 0;font-size:11px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.paper{box-shadow:none;max-width:none}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="paper">${inner}</div>
        </body></html>`;

        const w = window.open('', '_blank', 'width=420,height=760');
        if (!w) { this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para imprimir el ticket.' }); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
    }
}
