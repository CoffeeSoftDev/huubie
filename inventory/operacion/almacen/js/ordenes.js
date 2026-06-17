let apiOrdenes = 'ctrl/ctrl-ordenes.php';
let app, ordenes, ordenesView;

$(async () => {
    ordenesView = new OrdenesView(apiOrdenes, 'root');
    ordenes     = new Ordenes(apiOrdenes, 'root');
    app         = new App(apiOrdenes, 'root');
    await app.init();
});

// ============================================================
// App — bootstrap, layout, filterBar, navegación
// ============================================================

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ordenes';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        const r = await useFetch({ url: apiOrdenes, data: { opc: 'init' } });
        if (r && r.status === 200) {
            this.dataInit = {
                companies_id:  r.companies_id  || '',
                branch_id:     r.branch_id     || '',
                user_id:       r.user_id       || '',
                sucursales:    r.sucursales    || [],
                almacenes:     r.almacenes     || [],
                proveedores:   r.proveedores   || [],
                productos:     r.productos     || [],
                estados_orden: r.estados_orden || []
            };
        } else {
            this.dataInit = {
                companies_id:  '',
                branch_id:     '',
                user_id:       '',
                sucursales:    [],
                almacenes:     [],
                proveedores:   [],
                productos:     [],
                estados_orden: []
            };
        }
        this.subId = this.dataInit.branch_id;
        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        ordenesView.renderHeader({
            title:    'Ordenes de Compra',
            subtitle: 'Solicitudes de materiales, aprobacion y recepcion por sucursal'
        });
        ordenesView.renderDetail(null);
        this.populateFilters();
        ordenes.lsOrdenes();
        ordenes.lsKpis();
    }

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden',
            children: [
                {
                    id:    'emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailPanel]
            }
        });
    }

    filterBar() {
        const estados = this.dataInit.estados_orden || [];

        const filters = [
            {
                opc:         'input',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-4 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'branch_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                data:     [{ id: '', valor: '-- Todas --' }]
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    'Activas',
                data:     estados
            },
            {
                opc:      'select',
                id:       'fProveedor',
                lbl:      'Proveedor:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                data:     [{ id: '', valor: '-- Todos --' }]
            },
            {
                opc:       'button',
                id:        'btnNuevaOrden',
                text:      'Nueva orden',
                color_btn: 'invernal',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => ordenesView.openOrdenForm()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        this.initRangePicker();
    }

    initRangePicker() {
        this.rangeFi = moment().subtract(6, 'days').format('YYYY-MM-DD');
        this.rangeFf = moment().format('YYYY-MM-DD');

        dataPicker({
            parent: 'fRango',
            type:   'all',
            rangepicker: {
                startDate:           moment().subtract(6, 'days'),
                endDate:             moment(),
                showDropdowns:       true,
                alwaysShowCalendars: true,
                ranges: {
                    'Hoy':            [moment(), moment()],
                    'Ayer':           [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Ultimos 7 dias': [moment().subtract(6, 'days'), moment()],
                    'Semana actual':  [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Mes actual':     [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':   [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: {
                    format:           'YYYY-MM-DD',
                    separator:        '  a  ',
                    applyLabel:       'Aplicar',
                    cancelLabel:      'Cancelar',
                    customRangeLabel: 'Personalizado',
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay:         1
                }
            },
            onSelect: (start, end) => {
                this.rangeFi = start.format('YYYY-MM-DD');
                this.rangeFf = end.format('YYYY-MM-DD');
                this.onChangeFilters();
            }
        });
    }

    populateFilters() {
        const sucursales  = this.dataInit.sucursales  || [];
        const proveedores = this.dataInit.proveedores || [];

        if (sucursales.length) {
            this.populateSelect('branch_id', sucursales);
        }
        if (proveedores.length) {
            this.populateSelect('fProveedor', proveedores);
        }
        if (sucursales.length <= 1) {
            $('#branch_id').find('option[value=""]').remove();
            $('#branch_id').val(this.subId).prop('disabled', true);
        } else {
            $('#branch_id').val(this.subId);
        }
        $('#fProveedor').val('');
    }

    populateSelect(id, data) {
        const $sel = $(`#${id}`);
        if (!$sel.length) return;
        $sel.find('option:not(:first)').remove();
        data.forEach(item => {
            if (item.id === '' && $sel.find('option').first().val() === '') return;
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        const $branch = $('#branch_id');
        return {
            branch_id:   $branch.length ? ($branch.val() || '') : (this.subId || ''),
            supplier_id: $('#fProveedor').val() || '',
            status:      $('#fEstado').val()    || '',
            fi:          this.rangeFi           || '',
            ff:          this.rangeFf           || '',
            q:           $('#qBuscar').val()    || ''
        };
    }

    async onChangeFilters() {
        ordenes.lsOrdenes();
        await ordenes.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectOrden(null);
        }
    }

    // Click en una KPI card -> filtra la tabla por ese estado. Toggle: si el estado ya
    // está aplicado, vuelve al filtro por defecto (Activas, sin Cancelada).
    filterByKpi(kpi) {
        const st      = (kpi && kpi.status) || '';
        const current = $('#fEstado').val() || '';
        $('#fEstado').val(current === st ? 'Activas' : st);
        this.onChangeFilters();
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    selectOrden(folio, id) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
            ordenes.getOrden(id);
        } else {
            ordenesView.renderDetail(null);
        }
    }
}

// ============================================================
// Ordenes — datos, tabla, KPIs, impresión
// ============================================================

class Ordenes extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ordenes';
    }

    async lsOrdenes() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiOrdenes,
            data: Object.assign({ opc: 'lsOrdenes' }, {
                branch_id:   f.branch_id,
                supplier_id: f.supplier_id,
                status:      f.status,
                fi:          f.fi,
                ff:          f.ff,
                q:           f.q
            })
        });

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 5, 6],
            right:        [],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       13,
            emptyMessage: 'No se encontraron ordenes con los filtros aplicados',
            emptyIcon:    'clipboard-list',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }
        app.updateFooterInfo(`Mostrando ${total} orden${total !== 1 ? 'es' : ''}`);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiOrdenes,
            data: {
                opc:         'showOrdenes',
                branch_id:   f.branch_id,
                supplier_id: f.supplier_id,
                // El estado NO se envía a los KPIs: cuentan por estado, así que deben
                // reflejar el total real (si se filtrara, los demás caerían a 0 y dejarían
                // de servir como navegación). El filtro de estado solo aplica a la tabla.
                fi:          f.fi,
                ff:          f.ff,
                q:           f.q
            }
        });

        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiSolicitadas', label: 'Solicitadas',   value: parseInt(c.total_solicitadas || 0, 10), tone: 'warning', status: 'Solicitada' },
            { id: 'kpiAprobadas',   label: 'Aprobadas',     value: parseInt(c.total_aprobadas   || 0, 10), tone: 'default', status: 'Aprobada'   },
            { id: 'kpiParciales',   label: 'En recepcion',  value: parseInt(c.total_parciales   || 0, 10), tone: 'warning', status: 'Parcial'    },
            { id: 'kpiRecibidas',   label: 'Recibidas',     value: parseInt(c.total_recibidas   || 0, 10), tone: 'success', status: 'Recibida'   }
        ];
        ordenesView.renderInfoCards(kpis);
    }

    async getOrden(id) {
        const r = await useFetch({ url: apiOrdenes, data: { opc: 'getOrden', id: id } });
        if (r && r.status === 200) {
            ordenesView.renderDetail(this.mapOrdenDetail(r.header || {}, r.detail || []));
        } else {
            ordenesView.renderDetail(null);
        }
    }

    mapOrdenDetail(h, detail) {
        return {
            id:               h.id,
            folio:            h.folio,
            status:           h.status,
            status_badge:     h.status_badge || '',
            supplier_id:      h.supplier_id,
            supplier_name:    h.supplier_name || '',
            branch_id:        h.branch_id,
            branch_name:      h.branch_name  || '',
            destination_branch_id:   h.destination_branch_id,
            destination_branch_name: h.destination_branch_name || '',
            warehouse_id:     h.warehouse_id,
            warehouse_name:   h.warehouse_name || '',
            date_order:       h.date_order    || '',
            expected_date:    h.expected_date || '',
            note:             h.note          || '',
            user_name:        h.user_name     || '',
            approved_user_name: h.approved_user_name || '',
            approved_at:      h.approved_at   || '',
            reject_reason:    h.reject_reason || '',
            total_products:   parseInt(h.total_products || 0, 10),
            total_units:      Number(h.total_units  || 0),
            total_cost:       Number(h.total_cost   || 0),
            productos: (detail || []).map(d => ({
                detailId:          d.id,
                product_id:        d.product_id,
                nombre:            d.product_name,
                sku:               d.sku         || '',
                image:             d.image       || '',
                unit_id:           d.unit_id,
                quantity_ordered:  Number(d.quantity_ordered  || 0),
                quantity_received: Number(d.quantity_received || 0),
                price_without_tax: d.price_without_tax != null ? Number(d.price_without_tax) : null,
                tax:               d.tax  != null ? Number(d.tax)  : 0,
                cost:              d.cost != null ? Number(d.cost) : null,
                subtotal:          Number(d.subtotal || 0)
            }))
        };
    }

    async printOrden(arg) {
        let o = arg;
        if (!o || typeof o !== 'object') {
            const r = await useFetch({ url: apiOrdenes, data: { opc: 'printOrden', id: arg } });
            if (!(r && r.status === 200)) {
                if (typeof alert === 'function') alert({ icon: 'error', text: 'No se pudo cargar la orden para imprimir' });
                return;
            }
            o = this.mapOrdenDetail(r.header || {}, r.detail || []);
        }
        this._renderOrdenDoc(o);
    }

    _renderOrdenDoc(o) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (raw) => {
            if (!raw) return '-';
            const iso = String(raw).length <= 10 ? raw + 'T00:00:00' : String(raw).replace(' ', 'T');
            const d = new Date(iso);
            if (isNaN(d.getTime())) return raw;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
        };

        const productos = o.productos || [];
        const totals = productos.reduce((acc, p) => {
            acc.uds   += p.quantity_ordered;
            acc.recib += p.quantity_received;
            acc.costo += p.quantity_ordered * (p.cost || 0);
            return acc;
        }, { uds: 0, recib: 0, costo: 0 });

        const rowsHtml = productos.map(p => {
            const recibido  = p.quantity_received;
            const pendiente = Math.max(0, p.quantity_ordered - recibido);
            const hasCost   = p.cost != null;
            return `<tr>
                <td class="prod">
                    <span class="prod-name">${esc(p.nombre)}</span>
                    ${p.sku ? `<span class="sku">${esc(p.sku)}</span>` : ''}
                </td>
                <td class="c">${esc(p.quantity_ordered)}</td>
                <td class="c">${recibido > 0 ? `<span style="color:#3FC189;font-weight:700">${recibido}</span>` : '<span style="color:#9CA3AF">—</span>'}</td>
                <td class="c" style="color:${pendiente > 0 ? '#F97316' : '#9CA3AF'}">${pendiente > 0 ? pendiente : '—'}</td>
                <td class="r">${hasCost ? fmtMoney(p.cost) : '<span style="color:#9CA3AF">—</span>'}</td>
                <td class="r">${hasCost ? fmtMoney(p.quantity_ordered * p.cost) : '<span style="color:#9CA3AF">—</span>'}</td>
            </tr>`;
        }).join('');

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Orden ${esc(o.folio||'')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800}.folio{font-size:20px;font-weight:800;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px;margin-left:4px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}.doc-footer{margin-top:28px;display:flex;justify-content:space-between;font-size:10px;color:#777;border-top:1px solid #ccc;padding-top:10px}.reject-box{margin-bottom:18px;border-left:3px solid #E02424;background:#FEF2F2;padding:10px 14px;font-size:12px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header">
                <div>
                    <div class="doc-title">Orden de Compra</div>
                    <div style="font-size:12px;color:#555;margin-top:3px">${esc(o.branch_name||'')}${o.warehouse_name?' &middot; '+esc(o.warehouse_name):''}</div>
                </div>
                <div>
                    <div class="folio">${esc(o.folio||'-')}</div>
                    ${o.status?`<span class="status">${esc(o.status)}</span>`:''}
                </div>
            </div>
            ${o.reject_reason?`<div class="reject-box"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#E02424;display:block;margin-bottom:3px">Motivo de rechazo</strong>${esc(o.reject_reason)}</div>`:''}
            <div class="info-grid">
                <div class="info-item"><span class="k">Proveedor</span><span class="v">${esc(o.supplier_name||'Sin asignar')}</span></div>
                <div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(o.branch_name||'-')}</span></div>
                <div class="info-item"><span class="k">Fecha solicitud</span><span class="v">${esc(fmtFecha(o.date_order))}</span></div>
                ${o.expected_date?`<div class="info-item"><span class="k">Fecha esperada</span><span class="v">${esc(fmtFecha(o.expected_date))}</span></div>`:''}
                <div class="info-item"><span class="k">Solicitado por</span><span class="v">${esc(o.user_name||'-')}</span></div>
                ${o.approved_user_name?`<div class="info-item"><span class="k">Aprobado por</span><span class="v">${esc(o.approved_user_name)}</span></div>`:''}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th class="c">Pedido</th>
                        <th class="c">Recibido</th>
                        <th class="c">Pendiente</th>
                        <th class="r">Costo unit.</th>
                        <th class="r">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml||'<tr><td colspan="6" class="c">Sin productos</td></tr>'}</tbody>
            </table>
            <div class="totals">
                <div class="totals-box">
                    <div class="totals-row"><span>Tipos de material</span><span>${productos.length}</span></div>
                    <div class="totals-row"><span>Unidades pedidas</span><span>${totals.uds}</span></div>
                    <div class="totals-row"><span>Unidades recibidas</span><span>${totals.recib}</span></div>
                    <div class="totals-row grand"><span>Costo total</span><span>${fmtMoney(totals.costo)}</span></div>
                </div>
            </div>
            ${o.note?`<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(o.note)}</div>`:''}
            <div class="doc-footer">
                <span>Huubie &middot; Inventarios &middot; Orden de Compra</span>
                <span>Generado: ${esc(fmtFecha(new Date().toISOString().slice(0,10)))}</span>
            </div>
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Permite las ventanas emergentes para poder ver el documento.' });
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
    }
}

// ============================================================
// OrdenesView — paneles, modales, acciones por estado
// ============================================================

class OrdenesView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ordenes';
    }

    // ----------------------------------------------------------
    // Panel de detalle (aside derecho)
    // ----------------------------------------------------------

    renderDetail(orden) {
        this.ordenDetailPanel({
            parent:  'detailPanel',
            json:    orden,
            onClose: () => app.selectOrden(null),
            onPrint: (o) => { if (o) ordenes.printOrden(o); },
            onEdit:          (o) => this.openOrdenForm(o),
            onSubmit:        (o) => this.doSubmitOrden(o),
            onApprove:       (o) => this.doApproveOrden(o),
            onReject:        (o) => this.doRejectOrden(o),
            onRecibir:       (o) => (String(o && o.folio || '').startsWith('REAB-') ? this.openRecepcionModal(o) : this.openSurtidoModal(o)),
            onCancel:        (o) => this.doCancelOrden(o)
        });
    }

    // ----------------------------------------------------------
    // Acciones de estado — todas siguen el patrón swalQuestion
    // ----------------------------------------------------------

    doSubmitOrden(o) {
        if (!o || !o.id) return;
        this.swalQuestion({
            opts: {
                title:             `Enviar orden ${o.folio}`,
                text:              'La orden pasara a estado Solicitada y quedara pendiente de aprobacion.',
                icon:              'question',
                confirmButtonText: 'Si, enviar',
                cancelButtonText:  'No'
            },
            data: { opc: 'submitOrden', id: o.id },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Solicitud enviada' });
                        this._refreshAfterAction(o.folio, o.id);
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo enviar la orden' });
                    }
                }
            }
        });
    }

    doApproveOrden(o) {
        if (!o || !o.id) return;
        this.openAprobacionModal(o);
    }

    // Visor de decisión al aprobar: muestra lo pedido vs el stock disponible de un
    // almacén (informativo, no bloquea). Aprobar solo cambia el estado; el descuento
    // de inventario ocurre después, al surtir.
    openAprobacionModal(orden) {
        if (!orden || !orden.id) return;

        const self      = this;
        const esc       = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum    = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const almacenes = app.dataInit.almacenes || [];
        const productos = orden.productos || [];

        const warehouseFixed = !!(orden.warehouse_id);
        const optsAlm = `<option value="">-- Selecciona almacén --</option>` + almacenes.map(a =>
            `<option value="${a.id}"${String(orden.warehouse_id) === String(a.id) ? ' selected' : ''}>${esc(a.valor)}</option>`
        ).join('');

        const modalId = 'modalAprobacion';
        $(`#${modalId}`).remove();

        let stockMap    = {};
        let stockLoaded = false;

        const estadoCell = (disp, ped) => {
            if (disp === null) return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-400">—</span>`;
            if (disp >= ped)   return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(63,193,137,.15);color:#15803D"><i data-lucide="check" class="w-3 h-3"></i>Disponible</span>`;
            if (disp > 0)      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(249,115,22,.15);color:#C2410C"><i data-lucide="alert-triangle" class="w-3 h-3"></i>Parcial</span>`;
            return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(224,36,36,.15);color:#B91C1C"><i data-lucide="x" class="w-3 h-3"></i>Sin stock</span>`;
        };

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[640px] max-h-[90vh] bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style="background:#3FC189">
                                <i data-lucide="clipboard-check" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">Revisar y aprobar</h3>
                                <p class="text-[11px] text-gray-500">Solicitud <span class="font-semibold text-gray-700">${esc(orden.folio)}</span> &middot; ${orden.status_badge || ''}</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid #3FC189;background:rgba(63,193,137,.06)">
                            <i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:#15803D"></i>
                            <p class="text-[11px] text-gray-600 leading-relaxed">
                                Aprobar <span class="font-semibold text-gray-800">no descuenta inventario</span>: solo confirma la solicitud. El stock se descuenta después, al surtir. Revisa la disponibilidad para decidir.
                            </p>
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Almacén a consultar</label>
                            ${warehouseFixed
                                ? `<p class="px-2.5 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-md">${esc(orden.warehouse_name)}</p>
                                   <input type="hidden" id="${modalId}_warehouse_id" value="${orden.warehouse_id}">`
                                : `<div class="relative">
                                       <select id="${modalId}_warehouse_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8">${optsAlm}</select>
                                       <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                   </div>`
                            }
                        </div>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Pedido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Disp.</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Estado</th>
                                </tr>
                            </thead>
                            <tbody id="${modalId}_tbody" class="divide-y divide-gray-100"></tbody>
                        </table>
                    </div>

                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50">
                        <p id="${modalId}_resumen" class="text-[11px] text-gray-500">Selecciona un almacén para ver la disponibilidad.</p>
                    </div>

                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_cerrar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cerrar</button>
                        <div class="flex items-center gap-2">
                            <button id="${modalId}_rechazar" class="px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-all" style="border-color:#E02424;color:#E02424">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i><span>Rechazar</span>
                            </button>
                            <button id="${modalId}_aprobar" class="px-3 py-1.5 text-xs font-bold text-white rounded-md hover:shadow-lg transition-all flex items-center gap-1.5" style="background:#3FC189">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i><span>Aprobar</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const updateResumen = () => {
            const $r = $(`#${modalId}_resumen`);
            if (!stockLoaded) { $r.html('Selecciona un almacén para ver la disponibilidad.'); return; }
            let ok = 0;
            productos.forEach(p => {
                const ped = Math.max(0, p.quantity_ordered - p.quantity_received);
                const d   = stockMap[String(p.product_id)] || 0;
                if (ped > 0 && d >= ped) ok++;
            });
            const total = productos.length;
            const cls   = ok === total ? '#15803D' : (ok === 0 ? '#B91C1C' : '#C2410C');
            $r.html(`Puedes cubrir <strong style="color:${cls}">${ok}</strong> de <strong>${total}</strong> materiales con el stock de este almacén.`);
        };

        const renderRows = () => {
            $(`#${modalId}_tbody`).html(productos.map(p => {
                const ped     = Math.max(0, p.quantity_ordered - p.quantity_received);
                const disp    = stockLoaded ? (stockMap[String(p.product_id)] || 0) : null;
                const dispTxt = disp === null ? '—' : fmtNum(disp);
                const color   = disp === null ? '#9CA3AF' : (disp >= ped ? '#15803D' : (disp > 0 ? '#C2410C' : '#B91C1C'));
                return `
                    <tr>
                        <td class="px-3 py-2">
                            <p class="font-medium text-gray-700 text-xs">${esc(p.nombre)}</p>
                            ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                        </td>
                        <td class="px-3 py-2 text-center text-xs text-gray-600">${fmtNum(p.quantity_ordered)}</td>
                        <td class="px-3 py-2 text-center text-xs font-bold" style="color:${color}">${dispTxt}</td>
                        <td class="px-3 py-2 text-center">${estadoCell(disp, ped)}</td>
                    </tr>`;
            }).join(''));
            if (window.lucide) lucide.createIcons();
        };

        const loadStock = (warehouseId) => {
            if (!warehouseId) { stockLoaded = false; stockMap = {}; renderRows(); updateResumen(); return; }
            useFetch({ url: apiOrdenes, data: { opc: 'stockByWarehouse', warehouse_id: warehouseId } }).then(r => {
                stockMap    = (r && r.status === 200 && r.stock) ? r.stock : {};
                stockLoaded = true;
                renderRows();
                updateResumen();
            });
        };

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_cerrar`).on('click', closeModal);
        $modal.on('click', (ev) => { if ($(ev.target).is(`#${modalId}`)) closeModal(); });
        $(`#${modalId}_warehouse_id`).on('change', function () { loadStock($(this).val()); });

        $(`#${modalId}_rechazar`).on('click', () => { closeModal(); self.doRejectOrden(orden); });

        $(`#${modalId}_aprobar`).on('click', async () => {
            const $btn = $(`#${modalId}_aprobar`).prop('disabled', true).addClass('opacity-60 pointer-events-none');
            const r = await useFetch({ url: apiOrdenes, data: { opc: 'approveOrden', id: orden.id } }).catch(() => null);
            if (r && r.status === 200) {
                closeModal();
                self._refreshAfterAction(orden.folio, orden.id);
                const rDetalle = await useFetch({ url: apiOrdenes, data: { opc: 'getOrden', id: orden.id } }).catch(() => null);
                if (rDetalle && rDetalle.status === 200) {
                    const ordenActualizada = ordenes.mapOrdenDetail(rDetalle.header || {}, rDetalle.detail || []);
                    self.openSurtidoModal(ordenActualizada);
                }
            } else {
                $btn.prop('disabled', false).removeClass('opacity-60 pointer-events-none');
                if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo aprobar la orden' });
            }
        });

        if (warehouseFixed) loadStock(orden.warehouse_id);
        else                { renderRows(); updateResumen(); }
    }

    doRejectOrden(o) {
        if (!o || !o.id) return;
        this.alertBox({
            type:             'cancel',
            title:            `Rechazar orden ${o.folio}`,
            okLabel:          'Rechazar',
            cancelLabel:      'Cancelar',
            input:            'textarea',
            inputLabel:       'Motivo del rechazo',
            inputPlaceholder: 'Escribe el motivo...',
            inputRequired:    true,
            onOk: (value) => {
                const reason = (value || '').trim();
                useFetch({
                    url:  apiOrdenes,
                    data: { opc: 'rejectOrden', id: o.id, reason: reason }
                }).then(r => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Orden rechazada' });
                        app.selectOrden(null);
                        ordenes.lsOrdenes();
                        ordenes.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo rechazar la orden' });
                    }
                });
            }
        });
    }

    doCancelOrden(o) {
        if (!o || !o.id) return;
        this.swalQuestion({
            opts: {
                title:             `Cancelar orden ${o.folio}`,
                text:              'La orden quedara cancelada. Las recepciones parciales previas no se revierten.',
                icon:              'warning',
                confirmButtonText: 'Si, cancelar',
                cancelButtonText:  'No'
            },
            data: { opc: 'cancelOrden', id: o.id },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Orden cancelada' });
                        app.selectOrden(null);
                        ordenes.lsOrdenes();
                        ordenes.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo cancelar la orden' });
                    }
                }
            }
        });
    }

    _refreshAfterAction(folio, id) {
        ordenes.lsOrdenes();
        ordenes.lsKpis();
        if (folio && id) {
            setTimeout(() => app.selectOrden(folio, id), 300);
        } else {
            app.selectOrden(null);
        }
    }

    // ----------------------------------------------------------
    // Modal de nueva orden / edición
    // ----------------------------------------------------------

    openOrdenForm(orden) {
        const isEdit  = !!(orden && orden.id);
        const esc     = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum  = (n) => n != null ? Number(n).toFixed(2) : '';

        const sucursales  = (app.dataInit.sucursales  || []).filter(s => s.id !== '');
        const almacenes   = app.dataInit.almacenes    || [];
        const proveedores = (app.dataInit.proveedores || []).filter(p => p.id !== '');
        const productos   = app.dataInit.productos    || [];

        // Renglones iniciales (modo edición: se cargan del orden existente)
        let renglones = [];
        if (isEdit && orden.productos) {
            renglones = orden.productos.map(p => ({
                id:    p.product_id,
                nombre: p.nombre,
                sku:   p.sku,
                cant:  p.quantity_ordered,
                cost:  p.cost,
                tax:   p.tax,
                unit_id: p.unit_id
            }));
        }

        // Opciones select sucursal destino (a quien se le pide)
        const optsDest = `<option value="">-- Selecciona sucursal --</option>` + sucursales.map(s =>
            `<option value="${s.id}"${isEdit && String(orden.destination_branch_id) === String(s.id) ? ' selected' : ''}>${esc(s.valor)}</option>`
        ).join('');

        // Opciones select almacén
        const optsAlm = `<option value="">-- Sin definir --</option>` + almacenes.map(a =>
            `<option value="${a.id}"${isEdit && String(orden.warehouse_id) === String(a.id) ? ' selected' : ''}>${esc(a.valor)}</option>`
        ).join('');

        // Opciones select proveedor
        const optsProv = `<option value="">-- Sin proveedor --</option>` + proveedores.map(p =>
            `<option value="${p.id}"${isEdit && String(orden.supplier_id) === String(p.id) ? ' selected' : ''}>${esc(p.valor)}</option>`
        ).join('');

        const modalId  = 'modalOrdenForm';
        const $existing = $(`#${modalId}`);
        if ($existing.length) $existing.remove();

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[960px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <i data-lucide="clipboard-list" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">${isEdit ? 'Editar orden ' + esc(orden.folio) : 'Nueva orden de compra'}</h3>
                                <p class="text-[11px] text-gray-500">${isEdit ? 'Modifica los datos de la solicitud' : 'Arma la lista de materiales a solicitar'}</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Datos (zona fija) -->
                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Fecha de solicitud</label>
                                <input type="date" id="${modalId}_date_order" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all" value="${isEdit ? esc(orden.date_order) : moment().format('YYYY-MM-DD')}">
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sucursal destino</label>
                                <div class="relative">
                                    <select id="${modalId}_destination_branch_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">${optsDest}</select>
                                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                </div>
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Almacen destino <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <div class="relative">
                                    <select id="${modalId}_warehouse_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">${optsAlm}</select>
                                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                </div>
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Proveedor <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <div class="flex gap-2">
                                    <div class="relative flex-1">
                                        <select id="${modalId}_supplier_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">${optsProv}</select>
                                        <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                    </div>
                                    <button id="${modalId}_btnCrearProv" class="px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all flex items-center gap-1.5 whitespace-nowrap">
                                        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo
                                    </button>
                                </div>
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <input type="text" id="${modalId}_note" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400" placeholder="Comentario para quien revise la solicitud..." value="${isEdit ? esc(orden.note) : ''}">
                            </div>
                        </div>
                    </div>

                    <!-- Buscador (zona fija) -->
                    <div class="px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center"><i data-lucide="search" class="w-4 h-4"></i></span>
                            <input type="text" id="${modalId}_search" autocomplete="off" placeholder="Buscar materiales por nombre o SKU..." class="w-full pl-9 pr-3 py-2.5 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400">
                            <div id="${modalId}_results" class="hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden max-h-72 overflow-y-auto divide-y divide-gray-100"></div>
                        </div>
                    </div>

                    <!-- Encabezado lista (zona fija) -->
                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales a solicitar</p>
                    </div>

                    <!-- Lista de materiales (zona flexible con scroll) -->
                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Cantidad</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo unit.</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Tax %</th>
                                    <th class="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Subtotal</th>
                                    <th class="w-12 px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody id="${modalId}_tbody" class="divide-y divide-gray-100">
                            </tbody>
                        </table>
                    </div>

                    <!-- Resumen (zona fija) -->
                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-5 text-[11px] text-gray-500">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Unidades <strong class="text-gray-800 text-sm" id="${modalId}_totUds">0</strong></span>
                        </div>
                        <div class="flex items-baseline gap-2.5">
                            <span class="text-[10px] uppercase tracking-wider text-gray-500">Costo total</span>
                            <span class="font-bold text-lg leading-none" style="color:#3FC189" id="${modalId}_totCosto">$0.00</span>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_btnCancelar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all">Cancelar</button>
                        <div class="flex gap-2">
                            <button id="${modalId}_btnBorrador" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all flex items-center gap-1.5">
                                <i data-lucide="save" class="w-3.5 h-3.5"></i><span>Guardar borrador</span>
                            </button>
                            <button id="${modalId}_btnEnviar" class="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5">
                                <i data-lucide="send" class="w-3.5 h-3.5"></i><span>${isEdit ? 'Guardar cambios' : 'Guardar y enviar a revision'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        // Estado interno del modal
        let rows = [...renglones];

        const calcSubtotal = (cant, cost, tax) => {
            const c = Number(cost || 0);
            const q = Number(cant || 0);
            return q * c;
        };

        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const renderTbody = () => {
            const $tbody = $(`#${modalId}_tbody`);
            if (!rows.length) {
                $tbody.html(`<tr><td colspan="6" class="px-3 py-4 text-center text-xs text-gray-400 italic">Agrega materiales usando el buscador</td></tr>`);
                $(`#${modalId}_totUds`).text('0');
                $(`#${modalId}_totCosto`).text('$0.00');
                return;
            }
            $tbody.html(rows.map((row, idx) => {
                const sub = calcSubtotal(row.cant, row.cost, row.tax);
                return `
                    <tr data-idx="${idx}">
                        <td class="px-3 py-2">
                            <p class="font-medium text-gray-700">${esc(row.nombre)}</p>
                            ${row.sku ? `<p class="text-[10px] text-gray-400">${esc(row.sku)}</p>` : ''}
                        </td>
                        <td class="px-3 py-2">
                            <input type="number" data-field="cant" data-idx="${idx}" value="${row.cant}" min="0.01" step="0.01"
                                class="ord-field no-spin w-full px-2 py-1 text-xs font-bold text-center text-gray-800 bg-white border border-gray-300 rounded focus:border-[#C05A40] outline-none">
                        </td>
                        <td class="px-3 py-2">
                            <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">$</span>
                                <input type="number" data-field="cost" data-idx="${idx}" value="${row.cost != null ? row.cost : ''}" min="0" step="0.01" placeholder="—"
                                    class="ord-field no-spin w-full pl-5 pr-2 py-1 text-xs text-right text-gray-800 bg-white border border-gray-300 rounded focus:border-[#C05A40] outline-none">
                            </div>
                        </td>
                        <td class="px-3 py-2 text-center">
                            <input type="number" data-field="tax" data-idx="${idx}" value="${row.tax != null ? row.tax : 0}" min="0" step="0.01"
                                class="ord-field no-spin w-16 px-2 py-1 text-xs text-center text-gray-800 bg-white border border-gray-300 rounded focus:border-[#C05A40] outline-none">
                        </td>
                        <td class="px-3 py-2 text-right font-semibold text-gray-800 row-sub">${row.cost != null ? fmtMoney(sub) : '—'}</td>
                        <td class="px-3 py-2 text-center">
                            <button class="btn-remove-row text-gray-300 hover:text-rose-500" data-idx="${idx}">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </td>
                    </tr>`;
            }).join(''));
            if (window.lucide) lucide.createIcons();
            updateTotals();
        };

        const updateTotals = () => {
            let uds = 0, costo = 0;
            rows.forEach(r => {
                uds   += Number(r.cant || 0);
                costo += calcSubtotal(r.cant, r.cost, r.tax);
            });
            const udsVal = (uds % 1 === 0) ? String(uds) : uds.toFixed(2);
            $(`#${modalId}_totUds`).text(udsVal);
            $(`#${modalId}_totCosto`).text(fmtMoney(costo));
        };

        renderTbody();

        // Buscador de productos
        const $search  = $(`#${modalId}_search`);
        const $results = $(`#${modalId}_results`);

        $search.on('input', function () {
            const q = $(this).val().trim().toLowerCase();
            if (!q) { $results.addClass('hidden').html(''); return; }
            const found = productos.filter(p =>
                p.nombre.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
            ).slice(0, 20);
            if (!found.length) {
                $results.removeClass('hidden').html(`<div class="px-3 py-2 text-xs text-gray-400 italic">Sin resultados</div>`);
                return;
            }
            $results.removeClass('hidden').html(found.map(p => `
                <div class="prod-result flex items-center justify-between px-3 py-2.5 hover:bg-blue-50/60 cursor-pointer transition-all border-b border-gray-100 last:border-b-0"
                     data-id="${p.id}" data-nombre="${esc(p.nombre)}" data-sku="${esc(p.sku)}" data-cost="${p.costo}" data-tax="${p.tax != null ? p.tax : 0}">
                    <div class="flex items-center gap-2">
                        <span class="w-7 h-7 rounded bg-gray-100 flex items-center justify-center">
                            <i data-lucide="package" class="w-3.5 h-3.5 text-gray-500"></i>
                        </span>
                        <div>
                            <p class="text-xs font-medium text-gray-700">${esc(p.nombre)}</p>
                            <p class="text-[10px] text-gray-400">${esc(p.sku || 'Sin SKU')}</p>
                        </div>
                    </div>
                    <span class="text-[11px] font-semibold flex items-center gap-1" style="color:#C05A40">
                        <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Agregar
                    </span>
                </div>
            `).join(''));
            if (window.lucide) lucide.createIcons();
        });

        $results.on('click', '.prod-result', function () {
            const id   = String($(this).data('id'));
            const nombre = $(this).data('nombre');
            const sku  = $(this).data('sku');
            const cost = $(this).data('cost');
            const tax  = $(this).data('tax');
            const exists = rows.findIndex(r => String(r.id) === id);
            if (exists >= 0) {
                rows[exists].cant += 1;
            } else {
                rows.push({ id, nombre, sku, cant: 1, cost: cost || null, tax: tax || 0 });
            }
            $search.val('');
            $results.addClass('hidden').html('');
            renderTbody();
        });

        // Cambios en campos de renglones
        $(`#${modalId}_tbody`).on('input', '.ord-field', function () {
            const idx   = parseInt($(this).attr('data-idx'), 10);
            const field = $(this).attr('data-field');
            const val   = $(this).val();
            if (field === 'cant') {
                rows[idx].cant = parseFloat(val) || 0;
            } else if (field === 'cost') {
                rows[idx].cost = val === '' ? null : parseFloat(val);
            } else if (field === 'tax') {
                rows[idx].tax = parseFloat(val) || 0;
            }
            const sub = calcSubtotal(rows[idx].cant, rows[idx].cost, rows[idx].tax);
            $(this).closest('tr').find('.row-sub').text(rows[idx].cost != null ? fmtMoney(sub) : '—');
            updateTotals();
        });

        // Eliminar renglon
        $(`#${modalId}_tbody`).on('click', '.btn-remove-row', function () {
            const idx = parseInt($(this).attr('data-idx'), 10);
            rows.splice(idx, 1);
            renderTbody();
        });

        // Crear proveedor inline
        $(`#${modalId}_btnCrearProv`).on('click', () => {
            this.alertBox({
                type:        'confirm',
                title:       'Nuevo proveedor',
                okLabel:     'Crear',
                cancelLabel: 'Cancelar',
                detailHtml: `
                    <div class="text-left space-y-2 text-sm">
                        <div><label class="block text-xs font-semibold text-gray-600 mb-0.5">Nombre *</label>
                        <input id="ab_prov_name" class="w-full px-3 py-1.5 text-[13px] border border-gray-300 rounded-xl focus:outline-none" placeholder="Nombre del proveedor"></div>
                        <div><label class="block text-xs font-semibold text-gray-600 mb-0.5">Contacto</label>
                        <input id="ab_prov_contact" class="w-full px-3 py-1.5 text-[13px] border border-gray-300 rounded-xl focus:outline-none" placeholder="Nombre de contacto"></div>
                        <div><label class="block text-xs font-semibold text-gray-600 mb-0.5">Telefono</label>
                        <input id="ab_prov_phone" class="w-full px-3 py-1.5 text-[13px] border border-gray-300 rounded-xl focus:outline-none" placeholder="Telefono"></div>
                        <div><label class="block text-xs font-semibold text-gray-600 mb-0.5">Email</label>
                        <input id="ab_prov_email" class="w-full px-3 py-1.5 text-[13px] border border-gray-300 rounded-xl focus:outline-none" placeholder="Email"></div>
                    </div>
                `,
                onOk: () => {
                    // Los campos viven en detailHtml (no en el input nativo de alertBox),
                    // por eso la validacion del nombre se hace aqui, no con inputValidator.
                    const name = ($('#ab_prov_name').val() || '').trim();
                    if (!name) {
                        this.alertBox({ type: 'warning', title: 'El nombre es obligatorio', detailHtml: 'Captura el nombre del proveedor para continuar.', timer: 1800 });
                        return;
                    }
                    const payload = {
                        name:         name,
                        contact_name: ($('#ab_prov_contact').val() || '').trim(),
                        phone:        ($('#ab_prov_phone').val()   || '').trim(),
                        email:        ($('#ab_prov_email').val()   || '').trim()
                    };
                    useFetch({
                        url:  apiOrdenes,
                        data: Object.assign({ opc: 'createSupplier' }, payload)
                    }).then(r => {
                        if (r && r.status === 200 && r.id) {
                            if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Proveedor creado' });
                            const $sel = $(`#${modalId}_supplier_id`);
                            if (!$sel.find(`option[value="${r.id}"]`).length) {
                                $sel.append(`<option value="${r.id}">${esc(r.valor)}</option>`);
                            }
                            $sel.val(r.id);
                        } else {
                            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo crear el proveedor' });
                        }
                    });
                }
            });
        });

        // Cerrar modal
        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_btnCancelar`).on('click', closeModal);
        $modal.on('click', (e) => { if ($(e.target).is(`#${modalId}`)) closeModal(); });

        // Guardar borrador
        $(`#${modalId}_btnBorrador`).on('click', () => this._submitOrdenForm(modalId, rows, isEdit, orden, false, closeModal));

        // Guardar y enviar
        $(`#${modalId}_btnEnviar`).on('click', () => {
            if (isEdit) {
                this._submitOrdenForm(modalId, rows, true, orden, false, closeModal);
            } else {
                this._submitOrdenForm(modalId, rows, false, orden, true, closeModal);
            }
        });
    }

    async _submitOrdenForm(modalId, rows, isEdit, orden, submit, closeModal) {
        if (!rows.length) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Agrega al menos un material' });
            return;
        }

        const payload = {
            branch_id:             (isEdit && orden ? orden.branch_id : ($('#branch_id').val() || app.subId)) || '',
            destination_branch_id: $(`#${modalId}_destination_branch_id`).val() || '',
            warehouse_id:          $(`#${modalId}_warehouse_id`).val()          || '',
            supplier_id:           $(`#${modalId}_supplier_id`).val()           || '',
            date_order:            $(`#${modalId}_date_order`).val()            || moment().format('YYYY-MM-DD'),
            note:                  $(`#${modalId}_note`).val()                  || '',
            submit:                submit,
            productos:     rows.map(r => ({
                product_id:        r.id,
                quantity:          r.cant,
                cost:              r.cost,
                price_without_tax: null,
                tax:               r.tax != null ? r.tax : 0,
                unit_id:           r.unit_id || null
            }))
        };

        const data = isEdit
            ? { opc: 'editOrden', id: orden.id, payload: JSON.stringify(payload) }
            : { opc: 'saveOrden', payload: JSON.stringify(payload) };

        const r = await useFetch({ url: apiOrdenes, data: data });

        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: r.message || (isEdit ? 'Orden actualizada' : 'Orden creada') });
            closeModal();
            ordenes.lsOrdenes();
            ordenes.lsKpis();
            if (isEdit && orden && orden.folio) {
                setTimeout(() => app.selectOrden(orden.folio, orden.id), 300);
            }
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo guardar la orden' });
        }
    }

    // ----------------------------------------------------------
    // Modal de recepción
    // ----------------------------------------------------------

    openRecepcionModal(orden) {
        if (!orden || !orden.id) return;

        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum   = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const almacenes = app.dataInit.almacenes || [];

        // Si la OC ya tiene warehouse_id, lo mostramos fijo; si no, select
        const warehouseFixed = !!(orden.warehouse_id);
        const optsAlm = almacenes.map(a =>
            `<option value="${a.id}"${String(orden.warehouse_id) === String(a.id) ? ' selected' : ''}>${esc(a.valor)}</option>`
        ).join('');

        const modalId  = 'modalRecepcion';
        const $existing = $(`#${modalId}`);
        if ($existing.length) $existing.remove();

        const productos = orden.productos || [];

        const rowsHtml = productos.map(p => {
            const pendiente = Math.max(0, p.quantity_ordered - p.quantity_received);
            const completo  = pendiente <= 0;
            const iconHtml  = completo
                ? `<i data-lucide="check-circle-2" class="w-4 h-4 flex-shrink-0" style="color:#3FC189"></i>`
                : (p.quantity_received > 0
                    ? `<i data-lucide="circle-dashed" class="w-4 h-4 flex-shrink-0 text-orange-400"></i>`
                    : `<i data-lucide="circle" class="w-4 h-4 flex-shrink-0 text-gray-300"></i>`);
            const rowClass  = completo ? 'style="background:rgba(63,193,137,.05)"' : '';

            return `
                <tr ${rowClass}>
                    <td class="px-3 py-2">
                        <div class="flex items-center gap-2">
                            ${iconHtml}
                            <div>
                                <p class="font-medium text-gray-700 text-xs">${esc(p.nombre)}</p>
                                ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="px-3 py-2 text-center text-xs text-gray-600">${fmtNum(p.quantity_ordered)}</td>
                    <td class="px-3 py-2 text-center text-xs font-semibold" style="color:${p.quantity_received > 0 ? '#3FC189' : '#9CA3AF'}">${fmtNum(p.quantity_received)}</td>
                    <td class="px-3 py-2 text-center">
                        <input type="number" data-detail-id="${p.detailId}" data-max="${pendiente}"
                            value="${completo ? 0 : pendiente}" min="0" max="${pendiente}" step="0.01"
                            ${completo ? 'disabled' : ''}
                            class="rcv-qty no-spin w-full px-2 py-1 text-xs font-bold text-center text-gray-800 bg-white rounded outline-none ${completo ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'} border-gray-300">
                    </td>
                    <td class="px-3 py-2 text-center text-xs font-bold por-recibir" style="color:${pendiente > 0 ? '#F97316' : '#3FC189'}">${fmtNum(pendiente)}</td>
                </tr>`;
        }).join('');

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[960px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <i data-lucide="package-check" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">Recepcion de materiales</h3>
                                <p class="text-[11px] text-gray-500">Orden <span class="font-semibold text-gray-700">${esc(orden.folio)}</span> &middot; ${orden.status_badge}</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Aviso + almacen/nota (zona fija) -->
                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid #C05A40;background:rgba(192,90,64,.05)">
                            <i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:#C05A40"></i>
                            <p class="text-[11px] text-gray-600 leading-relaxed">
                                Al confirmar, se generara una <span class="font-semibold text-gray-800">entrada al inventario</span> con las cantidades indicadas en
                                <span class="font-semibold text-gray-800">"Recibe ahora"</span> y se afectara el stock del almacen destino.
                                Si no recibes todo, la orden quedara en estado <span class="font-semibold" style="color:#F97316">Parcial</span>.
                            </p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Almacen destino${warehouseFixed ? '' : ' *'}</label>
                                ${warehouseFixed
                                    ? `<p class="px-2.5 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-md">${esc(orden.warehouse_name)}</p>
                                       <input type="hidden" id="${modalId}_warehouse_id" value="${orden.warehouse_id}">`
                                    : `<div class="relative">
                                           <select id="${modalId}_warehouse_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">
                                               <option value="">-- Selecciona almacen --</option>
                                               ${optsAlm}
                                           </select>
                                           <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                       </div>`
                                }
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota de recepcion <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <input type="text" id="${modalId}_note" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400" placeholder="Observaciones: faltantes, danos, etc.">
                            </div>
                        </div>
                    </div>

                    <!-- Encabezado lista (zona fija) -->
                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales a recibir</p>
                    </div>

                    <!-- Tabla recepcion (zona flexible con scroll) -->
                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Pedido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Ya recibido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Recibe ahora</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Por recibir</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>

                    <!-- Resumen (zona fija) -->
                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-5 text-[11px] text-gray-500">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Recibe ahora <strong class="text-gray-800 text-sm" id="${modalId}_totRcv">0</strong></span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full" style="background:#F97316"></span>Pendientes <strong class="text-sm" style="color:#F97316" id="${modalId}_totPend">0</strong></span>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_btnCancelar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all">Cancelar</button>
                        <button id="${modalId}_btnConfirmar" class="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5">
                            <i data-lucide="package-check" class="w-3.5 h-3.5"></i><span>Confirmar recepcion</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const updateSummary = () => {
            let totalRcv = 0, totalPend = 0;
            $modal.find('.rcv-qty').each(function () {
                const max = parseFloat($(this).attr('data-max')) || 0;
                const val = parseFloat($(this).val()) || 0;
                const clamped = Math.min(Math.max(0, val), max);
                totalRcv  += clamped;
                totalPend += Math.max(0, max - clamped);
            });
            const fmtN = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
            $(`#${modalId}_totRcv`).text(fmtN(totalRcv));
            $(`#${modalId}_totPend`).text(fmtN(totalPend));
        };

        // Recalcular "por recibir" en vivo al teclear
        $modal.on('input', '.rcv-qty', function () {
            const max  = parseFloat($(this).attr('data-max')) || 0;
            let val    = parseFloat($(this).val());
            if (isNaN(val) || val < 0) val = 0;
            if (val > max) { val = max; $(this).val(max); }
            const pend = Math.max(0, max - val);
            const fmtN = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
            $(this).closest('tr').find('.por-recibir').text(fmtN(pend));
            $(this).closest('tr').find('.por-recibir').css('color', pend > 0 ? '#F97316' : '#3FC189');
            updateSummary();
        });

        updateSummary();

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_btnCancelar`).on('click', closeModal);
        $modal.on('click', (e) => { if ($(e.target).is(`#${modalId}`)) closeModal(); });

        $(`#${modalId}_btnConfirmar`).on('click', async () => {
            const warehouseId = $(`#${modalId}_warehouse_id`).val() || '';
            if (!warehouseFixed && !warehouseId) {
                this.alertBox({ type: 'warning', title: 'Selecciona el almacén de destino', timer: 1800 });
                return;
            }

            const items = {};
            $modal.find('.rcv-qty').each(function () {
                const did = $(this).attr('data-detail-id');
                const val = parseFloat($(this).val());
                if (!isNaN(val) && val > 0) items[did] = val;
            });

            if (!Object.keys(items).length) {
                this.alertBox({ type: 'warning', title: 'Indica al menos una cantidad a recibir', timer: 1800 });
                return;
            }

            const note = $(`#${modalId}_note`).val() || '';

            const r = await useFetch({
                url:  apiOrdenes,
                data: {
                    opc:          'receiveOrden',
                    id:           orden.id,
                    warehouse_id: warehouseId,
                    note:         note,
                    items:        JSON.stringify(items)
                }
            });

            if (r && r.status === 200) {
                this.alertBox({ type: 'success', title: r.message || 'Recepción registrada', timer: 2200 });
                closeModal();
                ordenes.lsOrdenes();
                ordenes.lsKpis();
                app.selectOrden(null);
            } else {
                this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo registrar la recepción' });
            }
        });
    }

    // ----------------------------------------------------------
    // Modal de surtido (la matriz descuenta de su almacen)
    // ----------------------------------------------------------

    openSurtidoModal(orden) {
        if (!orden || !orden.id) return;

        const esc       = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum    = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const almacenes = app.dataInit.almacenes || [];
        const productos = orden.productos || [];

        const warehouseFixed = !!(orden.warehouse_id);
        const optsAlm = `<option value="">-- Selecciona almacen --</option>` + almacenes.map(a =>
            `<option value="${a.id}"${String(orden.warehouse_id) === String(a.id) ? ' selected' : ''}>${esc(a.valor)}</option>`
        ).join('');

        const modalId = 'modalSurtido';
        $(`#${modalId}`).remove();

        let stockMap    = {};
        let stockLoaded = false;

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[1040px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style="background:#C05A40">
                                <i data-lucide="truck" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">Surtir solicitud</h3>
                                <p class="text-[11px] text-gray-500">Solicitud <span class="font-semibold text-gray-700">${esc(orden.folio)}</span> &middot; ${orden.status_badge || ''}</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid #C05A40;background:rgba(192,90,64,.05)">
                            <i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:#C05A40"></i>
                            <p class="text-[11px] text-gray-600 leading-relaxed">
                                Al confirmar se genera una <span class="font-semibold text-gray-800">salida</span> que descuenta el stock del almacen origen.
                                Si surtes mas de lo disponible, el faltante queda como una <span class="font-semibold text-gray-800">orden de compra de reabasto</span> pendiente, que deberas recibir cuando registres la compra.
                            </p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Almacen origen${warehouseFixed ? '' : ' *'}</label>
                                ${warehouseFixed
                                    ? `<p class="px-2.5 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-md">${esc(orden.warehouse_name)}</p>
                                       <input type="hidden" id="${modalId}_warehouse_id" value="${orden.warehouse_id}">`
                                    : `<div class="relative">
                                           <select id="${modalId}_warehouse_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8">${optsAlm}</select>
                                           <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                       </div>`
                                }
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <input type="text" id="${modalId}_note" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 placeholder:text-gray-400" placeholder="Observaciones del surtido...">
                            </div>
                        </div>
                    </div>

                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales a surtir</p>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-16">Pedido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Surtido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Disp.</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">A surtir</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Reabastecer</th>
                                </tr>
                            </thead>
                            <tbody id="${modalId}_tbody" class="divide-y divide-gray-100"></tbody>
                        </table>
                    </div>

                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-5 text-[11px] text-gray-500">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full" style="background:#C05A40"></span>A surtir <strong class="text-gray-800 text-sm" id="${modalId}_totSup">0</strong></span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Reabasto <strong class="text-gray-800 text-sm" id="${modalId}_totRep">0</strong></span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_btnCancelar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cancelar</button>
                        <button id="${modalId}_btnConfirmar" class="px-3 py-1.5 text-xs font-bold text-white rounded-md hover:shadow-lg transition-all flex items-center gap-1.5" style="background:#C05A40">
                            <i data-lucide="truck" class="w-3.5 h-3.5"></i><span>Confirmar surtido</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const recalc = () => {
            let totSup = 0, totRep = 0;
            $modal.find('.sur-qty').each(function () { totSup += parseFloat($(this).val()) || 0; });
            $modal.find('.sur-rep').each(function () { totRep += parseFloat($(this).val()) || 0; });
            const fmtN = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
            $(`#${modalId}_totSup`).text(fmtN(totSup));
            $(`#${modalId}_totRep`).text(fmtN(totRep));
        };

        const renderRows = () => {
            $(`#${modalId}_tbody`).html(productos.map(p => {
                const pendiente = Math.max(0, p.quantity_ordered - p.quantity_received);
                const disp      = stockLoaded ? (stockMap[String(p.product_id)] || 0) : null;
                const dispTxt   = disp === null ? '—' : fmtNum(disp);
                const aSurtir   = pendiente; // se propone surtir todo lo pendiente (agiliza la salida)
                const repInit   = disp === null ? 0 : Math.max(0, aSurtir - disp); // faltante -> reabasto
                const completo  = pendiente <= 0;
                const dispColor = (disp !== null && disp < pendiente) ? '#F97316' : '#3FC189';
                return `
                    <tr data-detail-id="${p.detailId}" data-product-id="${p.product_id}" data-pending="${pendiente}">
                        <td class="px-3 py-2">
                            <p class="font-medium text-gray-700 text-xs">${esc(p.nombre)}</p>
                            ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                        </td>
                        <td class="px-3 py-2 text-center text-xs text-gray-600">${fmtNum(p.quantity_ordered)}</td>
                        <td class="px-3 py-2 text-center text-xs font-semibold" style="color:${p.quantity_received > 0 ? '#3FC189' : '#9CA3AF'}">${fmtNum(p.quantity_received)}</td>
                        <td class="px-3 py-2 text-center text-xs font-bold sur-disp" style="color:${dispColor}">${dispTxt}</td>
                        <td class="px-3 py-2">
                            <input type="number" class="sur-qty no-spin w-full px-2 py-1 text-xs font-bold text-center text-gray-800 bg-white border border-gray-300 rounded focus:border-[#C05A40] outline-none ${completo ? 'bg-gray-100 text-gray-400' : ''}"
                                value="${completo ? 0 : aSurtir}" min="0" max="${pendiente}" step="0.01" ${completo ? 'disabled' : ''}>
                        </td>
                        <td class="px-3 py-2">
                            <input type="number" class="sur-rep no-spin w-full px-2 py-1 text-xs text-center text-gray-600 bg-gray-50 border border-gray-200 rounded outline-none cursor-default"
                                value="${completo ? 0 : repInit}" min="0" step="0.01" readonly tabindex="-1">
                        </td>
                    </tr>`;
            }).join(''));
            recalc();
        };

        const loadStock = (warehouseId) => {
            if (!warehouseId) { stockLoaded = false; stockMap = {}; renderRows(); return; }
            useFetch({ url: apiOrdenes, data: { opc: 'stockByWarehouse', warehouse_id: warehouseId } }).then(r => {
                stockMap    = (r && r.status === 200 && r.stock) ? r.stock : {};
                stockLoaded = true;
                renderRows();
            });
        };

        $(`#${modalId}_tbody`).on('input', '.sur-qty', function () {
            const $tr  = $(this).closest('tr');
            const pend = parseFloat($tr.attr('data-pending')) || 0;
            const pid  = String($tr.attr('data-product-id'));
            let val    = parseFloat($(this).val());
            if (isNaN(val) || val < 0) val = 0;
            if (val > pend) { val = pend; $(this).val(pend); }
            const disp  = stockLoaded ? (stockMap[pid] || 0) : 0;
            const falta = Math.max(0, val - disp);
            $tr.find('.sur-rep').val(falta % 1 === 0 ? falta : falta.toFixed(2));
            recalc();
        });
        $(`#${modalId}_tbody`).on('input', '.sur-rep', recalc);

        $(`#${modalId}_warehouse_id`).on('change', function () { loadStock($(this).val()); });

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_btnCancelar`).on('click', closeModal);
        $modal.on('click', (ev) => { if ($(ev.target).is(`#${modalId}`)) closeModal(); });

        if (warehouseFixed) loadStock(orden.warehouse_id);
        else                renderRows();

        $(`#${modalId}_btnConfirmar`).on('click', async () => {
            const warehouseId = $(`#${modalId}_warehouse_id`).val() || '';
            if (!warehouseId) {
                this.alertBox({ type: 'warning', title: 'Selecciona el almacén de origen', timer: 1800 });
                return;
            }
            const items = {}, replenish = {};
            $modal.find(`#${modalId}_tbody tr`).each(function () {
                const $tr = $(this);
                const did = $tr.attr('data-detail-id');
                const sup = parseFloat($tr.find('.sur-qty').val());
                const rep = parseFloat($tr.find('.sur-rep').val());
                if (!isNaN(sup) && sup > 0) items[did]     = sup;
                if (!isNaN(rep) && rep > 0) replenish[did] = rep;
            });
            if (!Object.keys(items).length) {
                this.alertBox({ type: 'warning', title: 'Indica al menos una cantidad a surtir', timer: 1800 });
                return;
            }
            const note = $(`#${modalId}_note`).val() || '';
            const r = await useFetch({
                url:  apiOrdenes,
                data: {
                    opc:          'fulfillOrden',
                    id:           orden.id,
                    warehouse_id: warehouseId,
                    note:         note,
                    items:        JSON.stringify(items),
                    replenish:    JSON.stringify(replenish)
                }
            });
            if (r && r.status === 200) {
                this.alertBox({ type: 'success', title: r.message || 'Surtido registrado', timer: 2200 });
                closeModal();
                ordenes.lsOrdenes();
                ordenes.lsKpis();
                app.selectOrden(null);
            } else {
                this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo surtir' });
            }
        });
    }

    // ----------------------------------------------------------
    // Panel de detalle (metodo principal)
    // ----------------------------------------------------------

    ordenDetailPanel(options) {
        const defaults = {
            parent:  'root',
            id:      'ordenDetailPanel',
            json:    null,
            labels: {
                emptyTitle:  'Selecciona una orden',
                emptyHint:   'Haz click en cualquier fila para ver el detalle aqui.',
                subtitleLbl: 'Detalle de orden'
            },
            onClose:   () => {},
            onPrint:   () => {},
            onEdit:    () => {},
            onSubmit:  () => {},
            onApprove: () => {},
            onReject:  () => {},
            onRecibir: () => {},
            onCancel:  () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtNum   = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);

        if (!opts.json) {
            $parent.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                    <i data-lucide="clipboard-list" class="w-10 h-10 text-gray-300 mb-3"></i>
                    <p class="text-sm font-semibold text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-xs text-gray-400 mt-1 max-w-[200px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e      = opts.json;
        const status = e.status || '';

        // Timeline stepper
        const steps = ['Borrador', 'Solicitada', 'Aprobada', 'Parcial', 'Recibida'];
        const specialStatuses = ['Rechazada', 'Cancelada'];
        const isSpecial = specialStatuses.includes(status);
        const activeIdx = isSpecial ? -1 : steps.indexOf(status);

        const stepperHtml = isSpecial
            ? `<div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
                   <span class="text-xs font-semibold px-2 py-0.5 rounded" style="background:rgba(224,36,36,.12);color:#E02424;">${esc(status.toUpperCase())}</span>
               </div>`
            : `<div class="flex items-center gap-0 px-4 py-2.5 border-b border-gray-200 flex-shrink-0 overflow-x-auto">
                   ${steps.map((s, i) => {
                       const done    = i < activeIdx;
                       const current = i === activeIdx;
                       const dotColor   = done || current ? '#C05A40' : '#D1D5DB';
                       const labelColor = current ? '#C05A40' : (done ? '#6B7280' : '#9CA3AF');
                       const lineColor  = done ? '#C05A40' : '#E5E7EB';
                       return `
                           <div class="flex items-center flex-shrink-0">
                               <div class="flex flex-col items-center">
                                   <div class="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style="background:${current ? '#C05A40' : (done ? '#C05A40' : '#fff')};border-color:${dotColor}"></div>
                                   <p class="text-[9px] font-semibold mt-0.5 whitespace-nowrap" style="color:${labelColor}">${esc(s === 'Recibida' ? 'Surtida' : s)}</p>
                               </div>
                               ${i < steps.length - 1 ? `<div class="h-0.5 w-6 flex-shrink-0 mb-3" style="background:${lineColor}"></div>` : ''}
                           </div>`;
                   }).join('')}
               </div>`;

        // Materiales
        const productosHtml = (e.productos || []).map(p => {
            const recibido  = p.quantity_received;
            const ordenado  = p.quantity_ordered;
            const hasCost   = p.cost != null;
            const subHtml   = hasCost ? `<div class="text-xs text-gray-500 ml-1">${fmtMoney(p.cost)}</div>` : `<div class="text-xs text-gray-400 ml-1 italic">$—</div>`;
            const recvBadge = recibido > 0
                ? `<span class="text-[10px] font-bold ml-1" style="color:#3FC189">(${fmtNum(recibido)} rec.)</span>`
                : '';
            return `
                <div class="flex items-center justify-between py-2 border-b border-gray-100 gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-gray-700 truncate">${esc(p.nombre)}${recvBadge}</p>
                        ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                    </div>
                    <div class="text-right flex-shrink-0 flex items-center gap-2">
                        <div class="text-xs font-semibold text-gray-800">${fmtNum(ordenado)}</div>
                        ${subHtml}
                    </div>
                </div>`;
        }).join('');

        // Totales
        const totUds   = (e.productos || []).reduce((s, p) => s + p.quantity_ordered, 0);
        const totCosto = (e.productos || []).reduce((s, p) => s + p.quantity_ordered * (p.cost || 0), 0);

        // Barra de acciones por estado
        const btnCls = (color, text, icon, id) =>
            `<button id="${opts.id}_${id}" class="flex-1 px-2 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1" style="background:${color}">
                <i data-lucide="${icon}" class="w-3 h-3"></i>${text}
             </button>`;

        // Rol por sucursal: "origen" = sucursal solicitante (e.branch_id); "destino" =
        // sucursal a la que se le pide (e.destination_branch_id). El origen solo puede
        // cancelar su solicitud; el destino aprueba, rechaza y recibe. La distincion solo
        // aplica en solicitudes inter-sucursal (hay un destino distinto del origen). Si la
        // orden no tiene destino, o el usuario no es ninguna de las dos sucursales, el
        // gestor conserva todas las acciones (comportamiento previo).
        const miSucursal   = String((app && app.subId != null ? app.subId : (app && app.dataInit ? app.dataInit.branch_id : '')) || '');
        const ordenBranch  = String(e.branch_id != null ? e.branch_id : '');
        const ordenDestino = String(e.destination_branch_id != null ? e.destination_branch_id : '');
        const interSucursal  = ordenDestino !== '' && ordenDestino !== ordenBranch && miSucursal !== '';
        const sinRestriccion = !interSucursal; // sin destino / mono-sucursal / legacy -> acciones completas
        const esOrigen     = interSucursal && miSucursal === ordenBranch;
        const esDestino    = interSucursal && miSucursal === ordenDestino;
        const roleScoped   = esOrigen || esDestino;
        // Las OC de reabasto (REAB-) son compras a recibir, no surtidos: se reciben para
        // reponer el almacen y cuadrar el deficit dejado por un surtido sin stock.
        const esReabasto   = String(e.folio || '').startsWith('REAB-');

        let actionsHtml = '';
        if (status === 'Borrador') {
            // El borrador solo lo gestiona su sucursal de origen.
            if (esOrigen || sinRestriccion) {
                actionsHtml = `
                    ${btnCls('#3B82F6', 'Editar',   'pencil', 'edit')}
                    ${btnCls('#C05A40', 'Enviar',   'send',   'submit')}
                    ${btnCls('#F97316', 'Cancelar', 'ban',    'cancel')}`;
            }
        } else if (status === 'Solicitada') {
            if (esDestino || sinRestriccion) {
                // Solo la sucursal de destino (o gestor sin restriccion) aprueba o rechaza.
                actionsHtml = `
                    ${btnCls('#3FC189', 'Aprobar',  'check', 'approve')}
                    ${btnCls('#E02424', 'Rechazar', 'x',     'reject')}`;
            } else if (esOrigen) {
                // La sucursal de origen solo puede cancelar su solicitud.
                actionsHtml = btnCls('#F97316', 'Cancelar', 'ban', 'cancel');
            }
        } else if (status === 'Aprobada') {
            if (esReabasto) {
                // OC de reabasto: se recibe la compra para reponer el almacen (no se surte).
                actionsHtml = `
                    ${btnCls('#3FC189', 'Recibir',  'package-check', 'recibir')}
                    ${btnCls('#F97316', 'Cancelar', 'ban',           'cancel')}`;
            } else if (sinRestriccion) {
                actionsHtml = `
                    ${btnCls('#C05A40', 'Surtir',   'truck', 'recibir')}
                    ${btnCls('#F97316', 'Cancelar', 'ban',   'cancel')}`;
            } else if (esDestino) {
                actionsHtml = btnCls('#C05A40', 'Surtir', 'truck', 'recibir');
            } else if (esOrigen) {
                actionsHtml = btnCls('#F97316', 'Cancelar', 'ban', 'cancel');
            }
        } else if (status === 'Parcial') {
            // La REAB- sí continúa recibiéndose (la compra puede llegar por partes).
            // Una solicitud Parcial es un surtido CERRADO: no se continúa; lo que faltó
            // se pide con una nueva solicitud. El estado solo indica "surtido incompleto".
            if (esReabasto) {
                actionsHtml = btnCls('#3FC189', 'Continuar recepción', 'package-check', 'recibir');
            }
        } else {
            actionsHtml = '';
        }

        // Bloque de motivo de rechazo
        const rejectHtml = (status === 'Rechazada' && e.reject_reason)
            ? `<div class="mx-4 my-2 rounded-lg px-3 py-2.5 flex-shrink-0" style="border-left:3px solid #E02424;background:rgba(224,36,36,.07)">
                   <p class="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style="color:#E02424">Motivo del rechazo</p>
                   <p class="text-xs text-gray-700">${esc(e.reject_reason)}</p>
               </div>`
            : '';

        $parent.html(`
            <div class="flex-1 flex flex-col overflow-hidden">

                <!-- Header folio + badge + cerrar -->
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitleLbl)}</p>
                        <p class="text-base font-bold text-gray-800">${esc(e.folio || '-')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${e.status_badge || `<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">${esc(status)}</span>`}
                        <button id="${opts.id}_print" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="Imprimir">
                            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                        </button>
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <!-- Stepper -->
                ${stepperHtml}

                ${rejectHtml}

                <!-- Datos de cabecera -->
                <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 space-y-1.5">
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 w-28 flex-shrink-0">Proveedor</span>
                        ${e.supplier_name
                            ? `<span class="text-gray-700 text-right">${esc(e.supplier_name)}</span>`
                            : `<span class="text-gray-400 italic text-right">— sin asignar</span>`}
                    </div>
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Sucursal solicitante</span><span class="text-gray-700 text-right">${esc(e.branch_name || '-')}</span></div>
                    ${e.destination_branch_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Sucursal destino</span><span class="text-gray-700 text-right">${esc(e.destination_branch_name)}</span></div>` : ''}
                    ${e.warehouse_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Almacen destino</span><span class="text-gray-700 text-right">${esc(e.warehouse_name)}</span></div>` : ''}
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Solicitado por</span><span class="text-gray-700 text-right">${esc(e.user_name || '-')}</span></div>
                    ${e.approved_user_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Aprobado por</span><span class="text-gray-700 text-right">${esc(e.approved_user_name)}</span></div>` : ''}
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Fecha solicitud</span><span class="text-gray-700 text-right">${esc(e.date_order || '-')}</span></div>
                    ${e.expected_date ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Fecha esperada</span><span class="text-gray-700 text-right">${esc(e.expected_date)}</span></div>` : ''}
                    ${e.note ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Nota</span><span class="text-gray-700 text-right">${esc(e.note)}</span></div>` : ''}
                </div>

                <!-- Lista de materiales -->
                <div class="flex-1 overflow-y-auto px-4 py-3">
                    <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Materiales (${(e.productos || []).length})</p>
                    ${productosHtml}
                </div>

                <!-- Totales -->
                <div class="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Unidades</span>
                        <span class="font-semibold text-gray-700">${fmtNum(totUds)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-700">Total general</span>
                        <span class="text-lg font-bold" style="color:#3FC189">${fmtMoney(totCosto)}</span>
                    </div>
                </div>

                ${actionsHtml ? `
                <!-- Barra de acciones -->
                <div class="px-4 py-3 border-t border-gray-200 flex-shrink-0">
                    ${roleScoped ? `
                    <p class="text-[10px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                        <i data-lucide="${esOrigen ? 'building' : 'building-2'}" class="w-3 h-3"></i>
                        ${esOrigen ? 'Tu sucursal es el origen de esta solicitud' : 'Tu sucursal es el destino de esta solicitud'}
                    </p>` : ''}
                    <div class="flex gap-2">
                        ${actionsHtml}
                    </div>
                </div>
                ` : ''}
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $parent.find(`#${opts.id}_close`).on('click',    () => opts.onClose(e));
        $parent.find(`#${opts.id}_print`).on('click',    () => opts.onPrint(e));
        $parent.find(`#${opts.id}_edit`).on('click',     () => opts.onEdit(e));
        $parent.find(`#${opts.id}_submit`).on('click',   () => opts.onSubmit(e));
        $parent.find(`#${opts.id}_approve`).on('click',  () => opts.onApprove(e));
        $parent.find(`#${opts.id}_reject`).on('click',   () => opts.onReject(e));
        $parent.find(`#${opts.id}_recibir`).on('click',  () => opts.onRecibir(e));
        $parent.find(`#${opts.id}_cancel`).on('click',   () => opts.onCancel(e));
    }

    // ----------------------------------------------------------
    // KPIs y header
    // ----------------------------------------------------------

    renderInfoCards(rows) {
        const current = $('#fEstado').val() || '';
        const match   = rows.find(k => String(k.status || '') === String(current));
        this.kpisRow({
            parent:   'kpisRow',
            json:     rows,
            activeId: match ? match.id : null,
            onClick:  (kpi) => app.filterByKpi(kpi)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: () => {}
        });
    }

   

    viewHeader(options) {
        const defaults = {
            parent:  'root',
            id:      'viewHeader',
            class:   'flex items-center justify-between w-full',
            json:    { title: '', subtitle: '' },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500'
            },
            onToggle: () => {}
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.json    = Object.assign({}, defaults.json,    (options || {}).json    || {});
        opts.classes = Object.assign({}, defaults.classes, (options || {}).classes || {});

        const esc  = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }
}
