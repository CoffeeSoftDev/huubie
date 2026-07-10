class Facturador extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
    }

    lsFolios() {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: Object.assign({ opc: 'lsFolios' }, app.getPeriodo()) })
        const per       = app.getPeriodo();
        const salesDia  = app.getSalesPeriodo();
        const tasaPorId = _calcTasasDia(salesDia);
        const visibles  = salesDia.filter(s => _isInvoiced(s) || !_isCashOnly(s));
        const st        = _computeStats(salesDia);

        facturadorView.foliosShell(FACTURADOR_TABS[0]);

        const rows = visibles.map(s => {
            const inv  = _invoiceOf(s);
            const fact = _isInvoiced(s);
            return {
                orden:     `<span class="font-semibold" style="color:#C05A40">${s.orderSeq || '-'}</span>`,
                posref:    `<span style="font-size:10px;color:#9CA3AF">${s.posRef || '-'}</span>`,
                facturado: fact ? '<i data-lucide="check-circle" class="w-4 h-4 text-green-600 inline-block"></i>' : '<span class="text-gray-300">—</span>',
                folio:     inv ? _badgeFolio(inv.folio) : '<span class="text-gray-300">—</span>',
                monto:     `<span class="font-semibold text-gray-800">${_money(_ticketTotal(s))}</span>`,
                tasa:      _badgeTasa(tasaPorId[s.id], fact),
                accion:    `<button class="ct-print" title="Imprimir" onclick="facturadorView.openTicket(${s.id})"><i data-lucide="printer" class="w-4 h-4"></i></button>`
            };
        });

        this.createCoffeeTable3({
            parent:       'foliosTable',
            id:           'tbFolios',
            theme:        'light',
            center:       [3, 6, 7],
            right:        [5],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      false,
            f_size:       11,
            emptyMessage: `Sin tickets en ${per.label}`,
            emptyIcon:    'icon-printer',
            data:         { thead: HEAD_FOLIOS, row: rows }
        });

        if (window.lucide) lucide.createIcons();

        const total = rows.length;
        // if (total > 0 && typeof simple_data_table === 'function') simple_data_table('#tbFolios', 10);
        $('#foliosCount').text(`${total} ticket${total !== 1 ? 's' : ''}`);

        facturadorView.resumenPanel({ parent: 'detailPanel', json: st, period: per, onConfig: () => app.openPctConfig() });
    }

    lsResumen() {
        const salesDia  = app.getSalesPeriodo();
        const st        = _computeStats(salesDia);
        const tasaPorId = _calcTasasDia(salesDia);

        facturadorView.resumenShell(FACTURADOR_TABS[1]);

        const pagos = salesDia.flatMap(s => s.payments.map(p => ({ s, p })));
        const rowsAcum = pagos.map(({ s, p }) => ({
            posref: `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
            orden:  s.orderSeq,
            forma:  _formaPagoName(p.formCode),
            monto:  `<span class="text-gray-800">${_money(p.totalCharged)}</span>`
        }));
        this.createCoffeeTable3({ parent: 'tblAcumulado', id: 'tbAcum', theme: 'light', right: [4], extends: true, scrollable: false, f_size: 11, emptyMessage: 'Sin pagos', emptyIcon: 'icon-doc', data: { thead: HEAD_ACUMULADO, row: rowsAcum } });

        const pend = salesDia.filter(s => !_isInvoiced(s) && s.payments.some(p => p.formCode === '04'));
        const rowsPend = pend.map(s => ({
            posref: `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
            orden:  s.orderSeq,
            monto:  `<span class="text-gray-800">${_money(_ticketTotal(s))}</span>`,
            tasa:   _badgeTasa(tasaPorId[s.id], false)
        }));
        this.createCoffeeTable3({ parent: 'tblPending', id: 'tbPend', theme: 'light', right: [3], center: [4], extends: true, scrollable: false, f_size: 11, emptyMessage: 'Sin pendientes', emptyIcon: 'icon-doc', data: { thead: HEAD_PENDING, row: rowsPend } });

        const fact = salesDia.filter(_isInvoiced);
        const rowsFact = fact.map(s => {
            const inv = _invoiceOf(s);
            return {
                posref: `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
                orden:  s.orderSeq,
                folio:  inv ? _badgeFolio(inv.folio) : '—',
                monto:  `<span class="text-green-700 font-semibold">${_money(_ticketTotal(s))}</span>`
            };
        });
        this.createCoffeeTable3({ parent: 'tblFacturado', id: 'tbFact', theme: 'light', right: [4], extends: true, scrollable: false, f_size: 11, emptyMessage: 'Sin facturas', emptyIcon: 'icon-doc', data: { thead: HEAD_FACTURADO, row: rowsFact } });

        facturadorView.fillResumenKpis(st);
        if (window.lucide) lucide.createIcons();
    }

    lsVentas() {
        const salesDia = app.getSalesPeriodo();
        facturadorView.ventasShell(FACTURADOR_TABS[2]);

        const rows = [];
        let pagosN = 0, tarjeta = 0, efectivo = 0;
        const ordenes = new Set();
        salesDia.forEach(s => {
            const fact = _isInvoiced(s);
            ordenes.add(`${s.operationDate}-${s.orderSeq}`);
            s.payments.forEach(p => {
                pagosN++;
                if (p.formCode === '04') tarjeta += p.totalCharged || 0; else efectivo += p.totalCharged || 0;
                rows.push({
                    posref:   `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
                    fact:     fact ? '<span class="badge-base b-green">Sí</span>' : '<span class="text-gray-300">—</span>',
                    forma:    _formaPagoName(p.formCode),
                    fecha:    _fmtDate(s.operationDate),
                    orden:    s.orderSeq,
                    mov:      s.posMovement,
                    estatus:  s.status,
                    mesero:   _nullCell(s.mesero),
                    terminal: _nullCell(s.terminal),
                    total:    `<span class="text-gray-800">${_money(p.amount)}</span>`,
                    propina:  _money(p.tip || 0),
                    cobrado:  `<span class="font-semibold text-gray-800">${_money(p.totalCharged)}</span>`
                });
            });
        });

        this.createCoffeeTable3({
            parent: 'ventasTable', id: 'tbVentas', theme: 'invernal',
            center: [2, 7], right: [10, 11, 12], extends: true, scrollable: true, f_size: 11,
            emptyMessage: 'Sin pagos en el periodo', emptyIcon: 'icon-credit-card',
            data: { thead: HEAD_VENTAS, row: rows }
        });

        facturadorView.fillVentasKpis({ pagos: pagosN, ordenes: ordenes.size, tarjeta, efectivo, foot: `${pagosN} pago${pagosN !== 1 ? 's' : ''}` });
        if (rows.length > 0 && typeof simple_data_table === 'function') simple_data_table('#tbVentas', 15);
        if (window.lucide) lucide.createIcons();
    }

    lsDetallado() {
        const salesDia = app.getSalesPeriodo();
        facturadorView.detalladoShell(FACTURADOR_TABS[3]);

        const rows = [];
        salesDia.forEach(s => {
            (s.details || []).forEach(d => {
                rows.push({
                    dia:        s.day,
                    fecha:      _fmtDate(s.operationDate),
                    orden:      s.orderSeq,
                    mesa:       _nullCell(s.mesa),
                    personas:   _nullCell(s.personas),
                    mesero:     _nullCell(s.mesero),
                    terminal:   _nullCell(s.terminal),
                    subtotal:   _money(d.subtotal),
                    iva:        _money(d.iva),
                    ieps:       _money(0),
                    total:      `<span class="font-semibold text-gray-800">${_money(d.total)}</span>`,
                    cant:       d.qty,
                    punit:      _money(d.price),
                    platillo:   d.name,
                    clave:      `<span style="font-size:11px;color:#6B7280">${d.clave}</span>`,
                    modificador: _nullCell(d.modifier)
                });
            });
        });

        this.createCoffeeTable3({
            parent: 'detalladoTable', id: 'tbDet', theme: 'invernal',
            center: [1, 3, 4, 5, 12], right: [8, 9, 10, 11, 13], extends: true, scrollable: true, f_size: 11,
            emptyMessage: 'Sin renglones en el periodo', emptyIcon: 'icon-list',
            data: { thead: HEAD_DETALLADO, row: rows }
        });

        facturadorView.setFoot('detFoot', `${rows.length} renglón${rows.length !== 1 ? 'es' : ''}`);
        if (rows.length > 0 && typeof simple_data_table === 'function') simple_data_table('#tbDet', 15);
    }

    lsFacturas() {
        const per = app.getPeriodo();
        const invoices = SAMPLE_FACTURADOR_INVOICES.filter(i => per.match(i.invoiceDate) || per.match(i.operationDate));
        facturadorView.facturasShell(FACTURADOR_TABS[4]);

        const vigentes = invoices.filter(i => i.status === 'Vigente');
        const canceladas = invoices.filter(i => i.status === 'Cancelado');
        const monto = vigentes.reduce((a, i) => a + (i.total || 0), 0);

        const rows = invoices.map(i => ({
            folio:  _badgeFolio(i.folio),
            rfc:    `<span style="font-size:11px;color:#6B7280">${i.rfc}</span>`,
            nombre: i.name,
            ref:    `<span style="font-size:11px;color:#9CA3AF">${i.reference}</span>`,
            estatus: i.status === 'Vigente' ? '<span class="badge-base b-green">Vigente</span>' : '<span class="badge-base b-red">Cancelado</span>',
            fecha:  _fmtDate(i.invoiceDate),
            subtotal: _money(i.subtotal),
            iva:    _money(i.tax),
            ieps:   _money(i.ieps || 0),
            total:  `<span class="font-semibold text-gray-800">${_money(i.total)}</span>`,
            uuid:   `<span style="font-size:10px;color:#9CA3AF">${i.uuid}</span>`,
            forma:  i.paymentFormCode,
            metodo: i.paymentMethodCode,
            orden:  i.orderNo,
            fechaop: _fmtDate(i.operationDate),
            tipo:   i.invoiceType
        }));

        this.createCoffeeTable3({
            parent: 'facturasTable', id: 'tbFacturas', theme: 'invernal',
            center: [5, 12, 13, 14], right: [7, 8, 9, 10], extends: true, scrollable: true, f_size: 11,
            emptyMessage: 'Sin facturas en el periodo', emptyIcon: 'icon-doc-text',
            data: { thead: HEAD_FACTURAS, row: rows }
        });

        facturadorView.fillFacturasKpis({ total: invoices.length, vigentes: vigentes.length, canceladas: canceladas.length, monto, foot: `${invoices.length} factura${invoices.length !== 1 ? 's' : ''}` });
        if (invoices.length > 0 && typeof simple_data_table === 'function') simple_data_table('#tbFacturas', 15);
        if (window.lucide) lucide.createIcons();
    }

    lsCatalogos() {
        facturadorView.catalogosShell(FACTURADOR_TABS[5]);

        const rowsBridge = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.map(p => ({
            clave:  `<span style="font-size:11px;color:#6B7280">${p.clave}</span>`,
            nombre: p.name,
            precio: `<span class="font-semibold text-gray-800">${_money(p.price)}</span>`,
            accion: `<div class="flex items-center justify-end gap-1">
                        <button class="ct-mini" title="Editar" onclick="facturadorView.openBridgeForm(${p.id})"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button class="ct-mini danger" title="Eliminar" onclick="facturador.delBridge(${p.id})"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                     </div>`
        }));
        this.createCoffeeTable3({ parent: 'bridgeTable', id: 'tbBridge', theme: 'light', right: [3, 4], extends: true, scrollable: false, f_size: 12, emptyMessage: 'Sin productos', emptyIcon: 'icon-doc', data: { thead: HEAD_BRIDGE, row: rowsBridge } });

        const rowsCust = SAMPLE_FACTURADOR_CUSTOMERS.map(c => ({
            rfc:    `<span style="font-size:11px;color:#6B7280">${c.rfc}</span>`,
            nombre: c.name,
            accion: `<div class="flex items-center justify-end gap-1">
                        <button class="ct-mini" title="Editar" onclick="facturadorView.openCustomerForm(${c.id})"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button class="ct-mini danger" title="Eliminar" onclick="facturador.delCustomer(${c.id})"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                     </div>`
        }));
        this.createCoffeeTable3({ parent: 'customersTable', id: 'tbCust', theme: 'light', right: [3], extends: true, scrollable: false, f_size: 12, emptyMessage: 'Sin clientes', emptyIcon: 'icon-doc', data: { thead: HEAD_CUSTOMERS, row: rowsCust } });

        facturadorView.fillParams(SAMPLE_FACTURADOR_META);
        if (window.lucide) lucide.createIcons();
    }

    getTicket(saleId) {
        const sale = SAMPLE_FACTURADOR_SALES.find(s => s.id === saleId);
        if (!sale) return null;
        return _buildVirtualTicket(sale);
    }

    tasaDeVenta(saleId) {
        const sale = SAMPLE_FACTURADOR_SALES.find(s => s.id === saleId);
        if (!sale) return '';
        return _calcTasasDia(app.getSalesPeriodo())[sale.id] || '';
    }

    setMetaPct(pct) {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'saveMeta', porcentaje: pct } })
        SAMPLE_FACTURADOR_META.porcentaje = pct / 100;
        app.renderActiveTab();
    }

    saveParams(pct, iva) {
        SAMPLE_FACTURADOR_META.porcentaje = isNaN(pct) ? SAMPLE_FACTURADOR_META.porcentaje : pct;
        SAMPLE_FACTURADOR_META.tasaIva    = isNaN(iva) ? SAMPLE_FACTURADOR_META.tasaIva : iva;
        facturadorView.alertBox({ type: 'success', title: 'Parámetros guardados', timer: 1400 });
        app.renderActiveTab();
    }

    saveBridge(data) {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'saveBridge', ...data } })
        if (data.id) {
            const p = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.find(x => x.id === +data.id);
            if (p) { p.clave = data.clave; p.name = data.name; p.price = +data.price; }
        } else {
            SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.push({ id: _nextId(SAMPLE_FACTURADOR_BRIDGE_PRODUCTS), clave: data.clave, name: data.name, price: +data.price });
        }
        this.lsCatalogos();
    }

    delBridge(id) {
        facturadorView.alertBox({
            type: 'confirm', title: '¿Eliminar producto puente?', okLabel: 'Eliminar',
            onOk: () => {
                const i = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.findIndex(x => x.id === id);
                if (i >= 0) SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.splice(i, 1);
                this.lsCatalogos();
            }
        });
    }

    saveCustomer(data) {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'saveCustomer', ...data } })
        if (data.id) {
            const c = SAMPLE_FACTURADOR_CUSTOMERS.find(x => x.id === +data.id);
            if (c) { c.rfc = data.rfc; c.name = data.name; }
        } else {
            SAMPLE_FACTURADOR_CUSTOMERS.push({ id: _nextId(SAMPLE_FACTURADOR_CUSTOMERS), rfc: data.rfc, name: data.name });
        }
        this.lsCatalogos();
    }

    delCustomer(id) {
        facturadorView.alertBox({
            type: 'confirm', title: '¿Eliminar cliente fiscal?', okLabel: 'Eliminar',
            onOk: () => {
                const i = SAMPLE_FACTURADOR_CUSTOMERS.findIndex(x => x.id === id);
                if (i >= 0) SAMPLE_FACTURADOR_CUSTOMERS.splice(i, 1);
                this.lsCatalogos();
            }
        });
    }
}
