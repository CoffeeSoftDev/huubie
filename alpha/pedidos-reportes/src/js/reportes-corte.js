class SummaryReport extends AppReportes {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "ReportesCorte";
    }

    async render() {
        let params = appReportes.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsCorte", ...params } });

        if (data.status === 403) return;

        const container = $(`#container-corte`);
        container.empty();

        const s          = data.summary || {};
        const c          = data.cuentas || {};
        const p          = data.pagos || {};
        const categorias = data.categorias || [];
        const shifts     = data.shifts || [];

        let subName = appReportes.getSubName();
        let now     = moment().format('DD/MM/YYYY hh:mm A');

        container.html(`
            <div class="pdf-document">
                <div class="pdf-header">
                    <div>
                        <h2>CORTE DE CAJA</h2>
                        <div class="meta">Sucursal: <span>${subName}</span></div>
                    </div>
                    <div style="text-align:right;display:flex;align-items:flex-start;gap:12px">
                        <div>
                            <div class="meta">${appReportes.dateMode === 'single' ? 'Dia' : 'Periodo'}: <span>${appReportes.dateMode === 'single' ? params.fi : `${params.fi} al ${params.ff}`}</span></div>
                            <div class="meta">Generado: <span>${now}</span></div>
                        </div>
                        <button onclick="window.print()" class="btn-print">Imprimir</button>
                    </div>
                </div>

                <div class="pdf-totals-bar" id="corte-totals-bar"></div>

                <div class="pdf-grid">
                    <div id="corte-cuentas"></div>
                    <div id="corte-caja"></div>
                    <div id="corte-descuentos"></div>
                    <div id="corte-ventas"></div>
                </div>

                <div class="pdf-grid-bottom">
                    <div id="corte-pago-ventas"></div>
                    <div id="corte-shifts-table"></div>
                </div>

                <div class="pdf-footer">
                    <span>Documento generado automaticamente</span>
                    <span>Pagina 1 de 1</span>
                </div>
            </div>
        `);

        PdfStyles.inject();
        this._renderCorteTotalsBar(s);
        this._renderCorteCuentas(c);
        this._renderCorteCaja(s, p);
        this._renderCorteDescuentos(c);
        this._renderCorteVentas(categorias, s);
        this._renderCortePagoVentas(p);
        this._renderCorteShiftsTable(shifts);
    }

    _renderCorteTotalsBar(s) {
        const items = [
            { label: 'Desc./Cort.',  value: s.total_descuentos },
            { label: 'Venta Bruta',  value: s.venta_bruta, highlight: true },
            { label: 'Efectivo',     value: s.total_efectivo },
            { label: 'Tarjeta',      value: s.total_tarjeta },
        ];

        let html = items.map(i => `
            <div class="total-item ${i.highlight ? 'highlight' : ''}">
                <div class="label">${i.label}</div>
                <div class="value">${i.value}</div>
            </div>
        `).join('');

        $(`#corte-totals-bar`).html(html);
    }

    _renderPdfSection(parent, title, rows) {
        let rowsHtml = rows.map(r => {
            if (r.isSubTitle) {
                return `<div class="pdf-sub-title">${r.label}</div>`;
            }

            let totalClass = r.total ? ' total-row' : '';
            let valClass   = r.negative ? ' negative' : '';

            return `
                <div class="pdf-kv${totalClass}">
                    <span class="kv-label">${r.label}</span>
                    <span class="kv-value${valClass}">${r.value}</span>
                </div>
            `;
        }).join('');

        $(`#${parent}`).html(`
            <div class="pdf-section">
                <div class="pdf-section-title">${title}</div>
                <div class="pdf-section-body">${rowsHtml}</div>
            </div>
        `);
    }

    _renderCorteCuentas(c) {
        this._renderPdfSection('corte-cuentas', 'Cuentas', [
            { label: 'Total Cuentas',   value: c.total },
            { label: 'Cotizaciones',    value: c.cotizaciones },
            { label: 'Pendientes',      value: c.pendientes },
            { label: 'Pagadas',         value: c.pagadas },
            { label: 'Canceladas',      value: c.canceladas },
            { label: 'Con Descuento',   value: `${c.con_descuento} &mdash; ${c.importe_descuentos}` },
            { label: 'Cuenta Promedio',  value: c.cuenta_promedio },
            { isSubTitle: true, label: 'Folios' },
            { label: 'Folio Inicial',   value: c.folio_inicial },
            { label: 'Folio Final',     value: c.folio_final },
        ]);
    }

    _renderCorteCaja(s, p) {
        this._renderPdfSection('corte-caja', 'Caja', [
            { label: '+ Efectivo Inicial', value: s.efectivo_inicial },
            { label: '+ Efectivo',         value: p.efectivo },
            { label: '+ Tarjeta',          value: p.tarjeta },
            { label: '+ Transferencia',    value: p.transferencia },
            { label: '= Saldo Final',      value: s.saldo_final, total: true },
        ]);
    }

    _renderCorteDescuentos(c) {
        this._renderPdfSection('corte-descuentos', 'Descuentos y Cortesias', [
            { isSubTitle: true, label: 'Cortesias' },
            { label: 'Total Cortesias',  value: '-' },
            { isSubTitle: true, label: 'Descuentos' },
            { label: 'Total Descuentos', value: c.importe_descuentos },
            { label: 'Total',            value: c.importe_descuentos, total: true },
        ]);
    }

    _renderCorteVentas(categorias, s) {
        let totalCategorias = 0;
        categorias.forEach(cat => { totalCategorias += cat.total; });

        let catHtml = '';
        const colors = ['#4a6785', '#7f9bb5', '#a3b8cc', '#5b7d9a', '#6e94b3'];

        categorias.forEach((cat, idx) => {
            let pct = totalCategorias > 0 ? Math.round((cat.total / totalCategorias) * 100) : 0;
            let color = colors[idx % colors.length];

            catHtml += `
                <div class="pdf-kv">
                    <span class="kv-label">${cat.categoria}</span>
                    <span class="kv-value">$${cat.total.toLocaleString('en-US', {minimumFractionDigits:2})} <small style="color:#7f8c8d">(${pct}%)</small></span>
                </div>
                <div class="pdf-pct-bar">
                    <div class="bar"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
                    <span class="pct-text">${pct}%</span>
                </div>
            `;
        });

        $(`#corte-ventas`).html(`
            <div class="pdf-section">
                <div class="pdf-section-title">Ventas</div>
                <div class="pdf-section-body">
                    <div class="pdf-sub-title">Por Tipo de Producto</div>
                    ${catHtml}
                    <div class="pdf-sub-title">Resumen</div>
                    <div class="pdf-kv"><span class="kv-label">Subtotal</span><span class="kv-value">${s.venta_bruta}</span></div>
                    <div class="pdf-kv"><span class="kv-label">- Desc. / Cort.</span><span class="kv-value negative">${s.total_descuentos}</span></div>
                    <div class="pdf-kv"><span class="kv-label">Venta Neta</span><span class="kv-value">${s.venta_neta}</span></div>
                    <div class="pdf-kv total-row"><span class="kv-label">Venta Bruta</span><span class="kv-value">${s.venta_bruta}</span></div>
                </div>
            </div>
        `);
    }

    _renderCortePagoVentas(p) {
        this._renderPdfSection('corte-pago-ventas', 'Forma de Pago Ventas', [
            { label: 'Efectivo',      value: p.efectivo },
            { label: 'Tarjeta',       value: p.tarjeta },
            { label: 'Transferencia', value: p.transferencia },
        ]);
    }

    _renderCorteShiftsTable(shifts) {
        if (!shifts.length) {
            $(`#corte-shifts-table`).html(`
                <div class="pdf-section">
                    <div class="pdf-section-title">Corte de Caja X</div>
                    <div class="pdf-section-body" style="text-align:center;color:#95a5a6;padding:20px">No hay turnos en este periodo</div>
                </div>
            `);
            return;
        }

        let rows = shifts.map(shift => `
            <tr>
                <td>${shift.employee_name}</td>
                <td>${shift.opened_at}</td>
                <td>${shift.closed_at}</td>
                <td class="text-right col-importe">${shift.total_sales}</td>
                <td class="text-right col-efectivo">${shift.total_cash}</td>
                <td class="text-right col-tarjeta">${shift.total_card}</td>
            </tr>
        `).join('');

        $(`#corte-shifts-table`).html(`
            <div class="pdf-section">
                <div class="pdf-section-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>Corte de Caja X</span>
                    <span style="font-size:10px;color:#95a5a6;font-weight:400">GERENTE</span>
                </div>
                <div style="overflow-x:auto">
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th>Responsable</th>
                                <th>Apertura</th>
                                <th>Cierre</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Efectivo</th>
                                <th class="text-right">Tarjeta</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `);
    }
}
