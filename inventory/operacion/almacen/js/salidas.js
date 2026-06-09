let apiSalidas = 'ctrl/ctrl-salidas.php';
let app, salidas, salidasView;

let branch_id;

window.updateSession = () => { };

$(async () => {
    salidasView = new SalidasView(apiSalidas, 'root');
    salidas     = new Salidas(apiSalidas, 'root');
    app        = new App(apiSalidas, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'salidas';
        this.subId        = null;
        this.statusDefault = 'Aplicada';
    }

    async init() {
        const r = await useFetch({ url: apiSalidas, data: { opc: 'init' } });
        if (r && r.status === 200) {
            this.dataInit = {
                branch_id: r.branch_id || '',
                sucursales:      r.sucursales       || [],
                motivos:         r.motivos_salida    || [],
                almacenes:       r.almacenes        || [],
                productos:       r.productos        || []
            };
        } else {
            this.dataInit = {
                branch_id: '',
                sucursales:      [],
                motivos:         [],
                almacenes:       [],
                productos:       []
            };
        }
        this.subId      = this.dataInit.branch_id;
        branch_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        salidasView.renderHeader({
            title:    'Salidas de Inventario',
            subtitle: 'Control de perdidas por sucursal, motivo y periodo'
        });
        salidasView.renderDetail(null);
        this.populateFilters();
        salidas.lsSalidas();
        salidas.lsKpis();
    }

    layout() {
        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
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
            type: 'aside',
            id:   'detailPanel',
            class: 'w-full md:w-[480px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden',
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
        let filters = [
            {
                opc:         'input',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-6 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'branch_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeFilters()',
                data:     [{ id: '', valor: '-- Todas --' }]
            },
            {
                opc:      'select',
                id:       'fMotivo',
                lbl:      'Motivo:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: '-- Todos --' }]
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-6 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    this.statusDefault,
                data: [
                    { id: '',          valor: '-- Todos --' },
                    { id: 'Aplicada',  valor: 'Aplicada'    },
                    { id: 'Cancelada', valor: 'Cancelada'   }
                ]
            },
            {
                opc:       'button',
                id:        'btnNuevaSalida',
                text:      'Nueva Salida',
                color_btn: 'invernal',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => salidas.openSalidaForm()
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
                    'Hoy':             [moment(), moment()],
                    'Ayer':            [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Ultimos 7 dias':  [moment().subtract(6, 'days'), moment()],
                    'Semana actual':   [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Semana anterior': [moment().subtract(1, 'week').startOf('isoWeek'), moment().subtract(1, 'week').endOf('isoWeek')],
                    'Mes actual':      [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':    [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
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
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('branch_id', sucursales);
            $('#branch_id').val(this.subId);
        }
        this.populateSelect('fMotivo', this.dataInit.motivos || []);
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
        return {
            branch_id: $('#branch_id').val() || this.subId || '',
            fi:              this.rangeFi               || '',
            ff:              this.rangeFf               || '',
            motivo:          $('#fMotivo').val()        || '',
            status:          $('#fEstado').val()        || ''
        };
    }

    async onChangeFilters() {
        salidas.lsSalidas();
        await salidas.lsKpis();
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }
}

class Salidas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'salidas';
    }

    async lsSalidas() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiSalidas,
            data: Object.assign({ opc: 'lsSalidas' }, {
                branch_id: f.branch_id,
                reason_id:       f.motivo,
                status:          f.status,
                fi:              f.fi,
                ff:              f.ff
            })
        });

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 5, 6, 8, 9, 10],
            right:        [7],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron salidas con los filtros aplicados',
            emptyIcon:    'icon-trash-empty',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }
        app.updateFooterInfo(`Mostrando ${total} salida${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiSalidas,
            data: {
                opc:             'showSalidas',
                branch_id: f.branch_id,
                reason_id:       f.motivo,
                status:          f.status,
                fi:              f.fi,
                ff:              f.ff
            }
        });

        const c   = (r && r.status === 200) ? r.counts : {};
        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const kpis = [
            { id: 'kpiPerdida',   label: 'Perdida total', value: fmt(c.total_costo),                   tone: 'danger'  },
            { id: 'kpiRegistros', label: 'Registros',     value: parseInt(c.total_salidas   || 0, 10),  tone: 'default' },
            { id: 'kpiUnidades',  label: 'Unidades',      value: parseInt(c.total_unidades || 0, 10),  tone: 'warning' },
            { id: 'kpiMotivo',    label: 'Motivo top',    value: c.motivo_top || '-',                   tone: 'purple'  }
        ];
        salidasView.renderInfoCards(kpis);
    }

    async getSalida(id) {
        const r = await useFetch({ url: apiSalidas, data: { opc: 'getSalida', id: id } });
        if (r && r.status === 200) {
            salidasView.renderDetail(this.mapSalidaDetail(r.header || {}, r.detail || []));
        } else {
            salidasView.renderDetail(null);
        }
    }

    mapSalidaDetail(h, detail) {
        const created = String(h.created_at || '');
        const ev      = h.evidence_url || '';
        const ver     = String(h.updated_at || h.created_at || '').replace(/[^0-9]/g, '');
        const foto    = ev ? ev + (ev.indexOf('?') === -1 ? '?' : '&') + 'v=' + ver : '';

        return {
            id:             h.id,
            folio:          h.folio,
            status:         h.status || '',
            motivo:         h.reason_name  || '',
            motivo_color:   h.reason_color || '',
            motivo_icon:    h.reason_icon  || '',
            fecha:          created ? created.replace(' ', 'T') : '',
            sucursal:       h.branch_name || '',
            almacen:        h.warehouse_name  || '',
            registrado_por: h.user_name ? { name: h.user_name } : null,
            nota:           h.note         || '',
            foto:           foto,
            items: (detail || []).map(d => ({
                name:        d.product_name,
                sku:         d.sku,
                categoria:   d.category_name || '',
                qty:         Number(d.quantity || 0),
                costo_unit:  Number(d.cost || 0),
                costo_total: Number(d.subtotal_loss != null ? d.subtotal_loss : Number(d.quantity || 0) * Number(d.cost || 0))
            })),
            total_unidades: Number(h.total_units     || 0),
            total_costo:    Number(h.total_cost_loss || 0)
        };
    }

    openSalidaForm() {
        const curSub = $('#branch_id').val() || app.subId;
        if (!this.salidaFormApi) {
            this.salidaFormApi = salidasView.salidaForm({
                parent: 'body',
                id:     'salidaFormModal',
                json:   app.dataInit.productos || [],
                data: {
                    motivos:         (app.dataInit.motivos    || []).filter(m => m.id !== ''),
                    sucursales:      (app.dataInit.sucursales || []).filter(s => s.id !== ''),
                    almacenes:       app.dataInit.almacenes || [],
                    fecha:           moment().format('YYYY-MM-DD'),
                    branch_id: curSub
                },
                onWarehouseChange: async (warehouseId, cb) => {
                    if (!warehouseId) { cb({}); return; }
                    const r = await useFetch({
                        url:  apiSalidas,
                        data: { opc: 'lsStockByWarehouse', warehouse_id: warehouseId }
                    });
                    cb((r && r.status === 200) ? (r.stock || {}) : {});
                },
                onSubmit: async (payload) => {
                    const backendPayload = {
                        note:                payload.nota || null,
                        evidence_b64:        payload.photo ? payload.photo.dataUrl : null,
                        status:              'Aplicada',
                        shrinkage_reason_id: payload.motivo,
                        warehouse_id:        payload.warehouseId,
                        branch_id:     payload.sucursalId,
                        productos:           payload.items.map(it => ({
                            product_id: it.id,
                            quantity:   it.qty,
                            cost:       it.costo
                        }))
                    };

                    const r = await useFetch({
                        url:  apiSalidas,
                        data: { opc: 'saveSalida', payload: JSON.stringify(backendPayload) }
                    });

                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || ('Salida ' + r.folio + ' registrada') });
                        this.lsSalidas();
                        this.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo registrar la salida' });
                    }
                },
                onClose: () => {}
            });
        }
        this.salidaFormApi.setData({ branch_id: curSub, fecha: moment().format('YYYY-MM-DD') });
        this.salidaFormApi.open();
    }

    async printSalida(arg) {
        let m = arg;
        if (!m || typeof m !== 'object') {
            const r = await useFetch({ url: apiSalidas, data: { opc: 'getSalida', id: arg } });
            if (!(r && r.status === 200)) {
                if (typeof alert === 'function') alert({ icon: 'error', text: 'No se pudo cargar la salida para imprimir' });
                return;
            }
            m = this.mapSalidaDetail(r.header || {}, r.detail || []);
        }
        this.renderSalidaDoc(m);
    }

    renderSalidaDoc(m) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            let h = d.getHours();
            const min = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()} ${h}:${min} ${ampm}`;
        };

        const items = m.items || [];
        const totals = items.reduce((acc, it) => {
            const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * Number(it.costo_unit || 0);
            acc.uds   += Number(it.qty || 0);
            acc.costo += sub;
            return acc;
        }, { uds: 0, costo: 0 });
        const totUds   = m.total_unidades != null ? m.total_unidades : totals.uds;
        const totCosto = m.total_costo    != null ? m.total_costo    : totals.costo;

        const byCat = {};
        items.forEach(it => {
            const cat = (it.categoria && String(it.categoria).trim()) || 'Sin categoria';
            (byCat[cat] = byCat[cat] || { categoria: cat, items: [] }).items.push(it);
        });
        const groups = Object.keys(byCat).sort((a, b) => a.localeCompare(b, 'es')).map(c => byCat[c]);

        const rowsHtml = groups.map(g => {
            const head = `<tr class="cat"><td colspan="4">${esc(g.categoria)} <span class="cat-count">${g.items.length}</span></td></tr>`;
            const body = g.items.map(it => {
                const cu  = Number(it.costo_unit || 0);
                const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * cu;
                return `<tr><td class="prod"><span class="prod-name">${esc(it.name)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td><td class="c">-${esc(it.qty)}</td><td class="r">${fmtMoney(cu)}</td><td class="r">-${fmtMoney(sub)}</td></tr>`;
            }).join('');
            return head + body;
        }).join('');

        const reg            = m.registrado_por && m.registrado_por.name ? m.registrado_por.name : '-';
        const fechaImpresion = fmtFecha(new Date().toISOString());

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Salida ${esc(m.folio||'')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800;color:#000}.folio{font-size:20px;font-weight:800;color:#000;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px;color:#000}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right;color:#000}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2;color:#000}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}tr.cat td{background:#efefef;font-weight:700;text-transform:uppercase;font-size:10px;color:#000;letter-spacing:.5px;padding:3px 8px;border-top:1px solid #000}.cat-count{float:right;color:#666;font-weight:600}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}.nota{margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;color:#222}.nota b{display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555}.doc-footer{margin-top:28px;display:flex;justify-content:space-between;font-size:10px;color:#777;border-top:1px solid #ccc;padding-top:10px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Comprobante de Salida</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(m.sucursal||'')}${m.almacen?' &middot; '+esc(m.almacen):''}</div></div><div><div class="folio">${esc(m.folio||'-')}</div>${m.status?`<span class="status">${esc(m.status)}</span>`:''}</div></div>
            <div class="info-grid"><div class="info-item"><span class="k">Motivo</span><span class="v">${esc(m.motivo||'-')}</span></div><div class="info-item"><span class="k">Fecha</span><span class="v">${esc(fmtFecha(m.fecha))}</span></div><div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(m.sucursal||'-')}</span></div><div class="info-item"><span class="k">Almacen</span><span class="v">${esc(m.almacen||'-')}</span></div><div class="info-item"><span class="k">Registrado por</span><span class="v">${esc(reg)}</span></div><div class="info-item"><span class="k">Productos</span><span class="v">${items.length} tipos · ${totUds} uds</span></div></div>
            <table><thead><tr><th>Producto</th><th class="c">Cant</th><th class="r">Costo unit.</th><th class="r">Subtotal</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="4" class="c">Sin productos</td></tr>'}</tbody></table>
            <div class="totals"><div class="totals-box"><div class="totals-row"><span>Tipos de producto</span><span>${items.length}</span></div><div class="totals-row"><span>Unidades</span><span>${totUds}</span></div><div class="totals-row grand"><span>Perdida total</span><span>-${fmtMoney(totCosto)}</span></div></div></div>
            ${m.nota?`<div class="nota"><b>Nota</b>${esc(m.nota)}</div>`:''}
            <div class="doc-footer"><span>Huubie &middot; Inventarios &middot; Comprobante de salida</span><span>Generado: ${esc(fechaImpresion)}</span></div>
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) { if (typeof alert === 'function') alert({ icon: 'warning', text: 'Permite las ventanas emergentes para poder ver el documento.' }); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    cancelSalida(id) {
        this.swalQuestion({
            opts: {
                title:             'Cancelar esta salida?',
                text:              'El stock de los productos sera restaurado. Accion irreversible.',
                icon:              'warning',
                confirmButtonText: 'Si, cancelar',
                cancelButtonText:  'No'
            },
            data: { opc: 'cancelSalida', id: id },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Salida cancelada' });
                        salidasView.renderDetail(null);
                        this.lsSalidas();
                        this.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo cancelar' });
                    }
                }
            }
        });
    }

    deleteSalida(id) {
        this.swalQuestion({
            opts: {
                title:             'Eliminar esta salida?',
                text:              'El formato cancelado se quitara del visor. Accion irreversible.',
                icon:              'warning',
                confirmButtonText: 'Si, eliminar',
                cancelButtonText:  'No'
            },
            data: { opc: 'deleteSalida', id: id },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Salida eliminada' });
                        salidasView.renderDetail(null);
                        this.lsSalidas();
                        this.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo eliminar' });
                    }
                }
            }
        });
    }

    async uploadEvidence(id, dataUrl) {
        if (!dataUrl) return;
        const r = await useFetch({
            url:  apiSalidas,
            data: { opc: 'saveSalidaEvidence', id: id, evidence_b64: dataUrl }
        });
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Evidencia actualizada' });
            this.getSalida(id);
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo guardar la evidencia' });
        }
    }

    removeEvidence(id) {
        this.swalQuestion({
            opts: {
                title:             'Quitar evidencia?',
                text:              'Se eliminara la foto de evidencia de esta salida.',
                icon:              'warning',
                confirmButtonText: 'Si, quitar',
                cancelButtonText:  'No'
            },
            data: { opc: 'saveSalidaEvidence', id: id, evidence_b64: '' },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Evidencia eliminada' });
                        this.getSalida(id);
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo eliminar la evidencia' });
                    }
                }
            }
        });
    }
}

class SalidasView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'salidas';
    }

    renderDetail(salida) {
        this.salidaDetailPanel({
            parent:           'detailPanel',
            json:             salida,
            onClose:          ()  => this.renderDetail(null),
            onImprimir:       (m) => { if (m) salidas.printSalida(m); },
            onCancelar:       (m) => { if (m) salidas.cancelSalida(m.id); },
            onDelete:         (m) => { if (m) salidas.deleteSalida(m.id); },
            onUploadEvidence: (m, dataUrl) => { if (m) salidas.uploadEvidence(m.id, dataUrl); },
            onRemoveEvidence: (m) => { if (m) salidas.removeEvidence(m.id); }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: () => {}
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: () => {}
        });
    }

    kpisRow(options) {
        const defaults = {
            parent:     'root',
            id:         'kpisRow',
            class:      'grid grid-cols-2 md:grid-cols-4 gap-4',
            json:       [],
            tones: {
                default: 'text-gray-800',
                success: 'text-green-600',
                warning: 'text-amber-500',
                danger:  'text-red-600',
                info:    'text-blue-600',
                purple:  'text-purple-600'
            },
            cardClass:  'bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:shadow-lg transition-shadow',
            labelClass: 'text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1',
            valueClass: 'text-2xl font-bold',
            onClick:    () => {}
        };

        const opts  = Object.assign({}, defaults, options || {});
        opts.tones  = Object.assign({}, defaults.tones, (options || {}).tones || {});

        const esc       = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;
        const grid      = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`<p class="col-span-full text-[10px] text-gray-500 italic text-center py-2">Sin indicadores</p>`);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => `
            <div id="${kpi.id || opts.id + '_' + idx}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                <p class="${opts.valueClass} ${toneClass(kpi.tone)}">${esc(kpi.value)}</p>
            </div>
        `).join(''));

        $(`#${opts.parent}`).html(grid);
        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            opts.onClick(opts.json[idx], idx);
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

        const opts   = Object.assign({}, defaults, options || {});
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

    salidaDetailPanel(options) {
        const defaults = {
            parent:   'root',
            id:       'salidaDetailPanel',
            class:    'w-full h-full flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden',
            json:     null,
            labels: {
                emptyTitle:  'Selecciona una salida',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de la perdida',
                motivo:      'Motivo',
                sucursal:    'Sucursal',
                almacen:     'Almacen',
                registrado:  'Registrado por',
                productos:   'Productos',
                perdidaTot:  'Perdida total',
                detalleLbl:  'Detalle de Productos',
                notaLbl:     'Nota',
                evidenciaLbl:'Foto de evidencia',
                sinFoto:     'Sin foto de evidencia',
                subirFoto:   'Subir evidencia',
                cambiarFoto: 'Cambiar',
                quitarFoto:  'Quitar',
                cant:        'Cant',
                costo:       'Costo',
                subtotal:    'Subtot',
                imprimir:    'Imprimir',
                cancelar:    'Cancelar',
                eliminar:    'Eliminar',
                folioPrefix: 'Salida'
            },
            motivoPalettes: {
                'Caducidad':        { bg: 'rgba(224,36,36,0.18)',  fg: '#F87171', icon: 'calendar-x'     },
                'Daniado':          { bg: 'rgba(251,191,36,0.18)', fg: '#FBBF24', icon: 'alert-triangle' },
                'Danado':           { bg: 'rgba(251,191,36,0.18)', fg: '#FBBF24', icon: 'alert-triangle' },
                'Error produccion': { bg: 'rgba(28,100,242,0.18)', fg: '#60A5FA', icon: 'settings'       },
                'Robo/Faltante':    { bg: 'rgba(124,58,237,0.18)', fg: '#A78BFA', icon: 'shield-alert'   },
                'Robo / Faltante':  { bg: 'rgba(124,58,237,0.18)', fg: '#A78BFA', icon: 'shield-alert'   },
                'Devolucion':       { bg: 'rgba(63,193,137,0.18)', fg: '#3FC189', icon: 'rotate-ccw'     }
            },
            statusPalettes: {
                'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Cancelada': { bg: 'rgba(224,36,36,0.15)',  fg: '#F87171' }
            },
            onClose:          () => {},
            onImprimir:       () => {},
            onCancelar:       () => {},
            onDelete:         () => {},
            onUploadEvidence: () => {},
            onRemoveEvidence: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.motivoPalettes = Object.assign({}, defaults.motivoPalettes, o.motivoPalettes || {});
        opts.statusPalettes = Object.assign({}, defaults.statusPalettes, o.statusPalettes || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const hexToRgba = (hex, a) => {
            const h = String(hex || '').trim().replace('#', '');
            if (h.length !== 6) return '';
            const rv = parseInt(h.slice(0, 2), 16);
            const gv = parseInt(h.slice(2, 4), 16);
            const bv = parseInt(h.slice(4, 6), 16);
            if ([rv, gv, bv].some(isNaN)) return '';
            return `rgba(${rv},${gv},${bv},${a})`;
        };

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            let h = d.getHours();
            const mi  = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()} · ${h}:${mi} ${ampm}`;
        };

        const compressImage = (file, cb) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const max = 1280;
                    let w = img.width, h = img.height;
                    if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    cb(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => cb(ev.target.result);
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };

        const actionsBar = (state) => {
            const s         = state || {};
            const empty     = !!s.empty;
            const cancelled = !!s.cancelled;
            const base      = 'flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5';
            const off       = 'opacity-40 cursor-not-allowed';
            const roseHover = empty ? off : 'hover:bg-rose-500 transition-all';

            const secondBtn = cancelled
                ? `<button id="${opts.id}_delete" class="${base} bg-rose-600 ${roseHover}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.eliminar)}</button>`
                : `<button id="${opts.id}_cancel" ${empty ? 'disabled' : ''} class="${base} bg-rose-600 ${roseHover}"><i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.cancelar)}</button>`;

            return `
                <div class="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
                    <button id="${opts.id}_print" ${empty ? 'disabled' : ''} class="${base} bg-sky-600 ${empty ? off : 'hover:bg-sky-500 transition-all'}">
                        <i data-lucide="printer" class="w-3.5 h-3.5"></i>${esc(opts.labels.imprimir)}
                    </button>
                    ${secondBtn}
                </div>`;
        };

        const emptyView = () => `
            <div class="px-3 py-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-gray-800">Vista de la Salida</h3>
                    <p class="text-[10px] text-gray-500">${esc(opts.labels.subtitleLbl)}</p>
                </div>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div class="w-14 h-14 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
                    <i data-lucide="package-x" class="w-6 h-6 text-gray-500"></i>
                </div>
                <p class="text-[11px] text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                <p class="text-[10px] text-gray-500 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
            </div>
            ${actionsBar({ empty: true })}
        `;

        const productTable = (m) => {
            const items = m.items || [];
            const byCat = {};
            items.forEach(it => {
                const cat = (it.categoria && String(it.categoria).trim()) || 'Sin categoria';
                (byCat[cat] = byCat[cat] || { categoria: cat, items: [] }).items.push(it);
            });
            const groups = Object.keys(byCat).sort((a, b) => a.localeCompare(b, 'es')).map(c => byCat[c]);

            const itemRow = (it) => {
                const cu  = Number(it.costo_unit || 0);
                const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * cu;
                return `
                    <tr class="border-b border-gray-100">
                        <td class="py-1.5 px-1">
                            <p class="text-[11px] font-bold text-gray-800 leading-tight">${esc(it.name)}</p>
                            ${it.sku ? `<p class="text-[10px] text-gray-500 leading-tight">${esc(it.sku)}</p>` : ''}
                        </td>
                        <td class="py-1.5 px-1 text-center whitespace-nowrap"><span class="text-rose-600 font-bold">-${it.qty}</span></td>
                        <td class="py-1.5 px-1 text-right text-gray-800 whitespace-nowrap">${fmtMoney(cu)}</td>
                        <td class="py-1.5 px-1 text-right text-gray-800 font-bold whitespace-nowrap">-${fmtMoney(sub)}</td>
                    </tr>`;
            };

            const groupBlock = (g) => {
                const head = `<tr><td colspan="4" class="px-2 pt-2.5 pb-1 bg-indigo-50"><div class="flex items-center justify-between"><span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 truncate">${esc(g.categoria)}</span><span class="text-[10px] text-gray-500 flex-shrink-0 ml-2">${g.items.length}</span></div></td></tr>`;
                return head + g.items.map(itemRow).join('');
            };

            return `
                <table class="w-full text-[11px] border-collapse">
                    <thead><tr class="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        <th class="py-1 px-1 text-left font-semibold">Producto</th>
                        <th class="py-1 px-1 text-center font-semibold">${esc(opts.labels.cant)}</th>
                        <th class="py-1 px-1 text-right font-semibold">${esc(opts.labels.costo)}</th>
                        <th class="py-1 px-1 text-right font-semibold">${esc(opts.labels.subtotal)}</th>
                    </tr></thead>
                    <tbody>${groups.map(groupBlock).join('') || `<tr><td colspan="4" class="py-2 text-center text-[12px] text-gray-500 italic">Sin productos</td></tr>`}</tbody>
                </table>`;
        };

        const fotoHtml = (foto, editable) => {
            const inputHtml = editable ? `<input type="file" id="${opts.id}_evdInput" accept="image/*" capture="environment" class="hidden">` : '';

            if (!foto) {
                if (!editable) return `<div class="bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200 flex flex-col items-center justify-center min-h-[100px]"><i data-lucide="image-off" class="w-7 h-7 text-gray-300 mb-2"></i><p class="text-[10px] text-gray-500 italic">${esc(opts.labels.sinFoto)}</p></div>`;
                return `${inputHtml}<button type="button" id="${opts.id}_evdUpload" class="w-full bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200 hover:border-sky-500/60 flex flex-col items-center justify-center min-h-[100px] transition-colors group"><i data-lucide="upload-cloud" class="w-7 h-7 text-gray-500 group-hover:text-sky-600 mb-2"></i><p class="text-[10px] text-gray-500 group-hover:text-gray-800">${esc(opts.labels.subirFoto)}</p></button>`;
            }

            if (!editable) return `<div class="rounded-lg overflow-hidden border border-gray-200"><img src="${esc(foto)}" alt="Evidencia" class="w-full h-32 object-cover" /></div>`;

            const btnBase = 'px-2 py-1 text-[10px] font-semibold text-white rounded-md flex items-center gap-1 transition-colors';
            return `${inputHtml}<div class="relative rounded-lg overflow-hidden border border-gray-200"><img src="${esc(foto)}" alt="Evidencia" class="w-full h-32 object-cover" /><div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center justify-end gap-1.5"><button type="button" id="${opts.id}_evdUpload" class="${btnBase} bg-sky-600/90 hover:bg-sky-500"><i data-lucide="refresh-cw" class="w-3 h-3"></i>${esc(opts.labels.cambiarFoto)}</button><button type="button" id="${opts.id}_evdRemove" class="${btnBase} bg-rose-600/90 hover:bg-rose-500"><i data-lucide="trash-2" class="w-3 h-3"></i>${esc(opts.labels.quitarFoto)}</button></div></div>`;
        };

        const filledView = (m) => {
            const items  = m.items || [];
            const totals = items.reduce((acc, it) => {
                const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * Number(it.costo_unit || 0);
                acc.uds   += Number(it.qty || 0);
                acc.costo += sub;
                return acc;
            }, { uds: 0, costo: 0 });

            const totUds   = m.total_unidades != null ? m.total_unidades : totals.uds;
            const totCosto = m.total_costo    != null ? m.total_costo    : totals.costo;

            const motivoC     = opts.motivoPalettes[m.motivo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF', icon: 'alert-triangle' };
            const motivoBg    = hexToRgba(m.motivo_color, 0.18) || motivoC.bg;
            const motivoFg    = m.motivo_color || motivoC.fg;
            const motivoIcon  = m.motivo_icon  || motivoC.icon || 'alert-triangle';
            const motivoBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:${motivoBg};color:${motivoFg};"><i data-lucide="${esc(motivoIcon)}" class="w-3 h-3"></i>${esc(m.motivo || '-')}</span>`;

            const stC         = opts.statusPalettes[m.status] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
            const statusBadge = m.status ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style="background:${stC.bg};color:${stC.fg};">${esc(m.status)}</span>` : '';

            const reg        = m.registrado_por;
            const regName    = reg && reg.name ? esc(reg.name) : '-';
            const regInitial = reg && reg.name ? esc(String(reg.name).trim().charAt(0).toUpperCase()) : '?';
            const regHtml    = reg && reg.name
                ? `<span class="flex items-center gap-1.5"><span class="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">${regInitial}</span><span class="text-gray-800 font-semibold">${regName}</span></span>`
                : `<span class="text-gray-800">-</span>`;

            const editable = m.status !== 'Cancelada';

            return `
                <div class="px-3 py-3 border-b border-gray-200 flex-shrink-0 flex items-start justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-base font-bold text-gray-800">${esc(opts.labels.folioPrefix)} ${esc(m.folio || '')}</h3>
                            ${statusBadge}
                        </div>
                        <p class="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <i data-lucide="clock" class="w-3 h-3"></i>${esc(fmtFecha(m.fecha))}
                        </p>
                    </div>
                    <button id="${opts.id}_close" class="text-gray-600 hover:text-gray-800 transition-colors p-1 flex-shrink-0" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <div id="${opts.id}_scroll" class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2.5">
                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500">${esc(opts.labels.motivo)}</span>${motivoBadge}</div>
                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500">${esc(opts.labels.sucursal)}</span><span class="text-gray-800 font-bold">${esc(m.sucursal || '-')}</span></div>
                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500">${esc(opts.labels.almacen)}</span><span class="text-gray-800 font-bold">${esc(m.almacen || '-')}</span></div>
                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500">${esc(opts.labels.registrado)}</span>${regHtml}</div>
                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500">${esc(opts.labels.productos)}</span><span class="text-gray-800 font-bold">${items.length} tipos · ${totUds} uds</span></div>
                    </div>

                    <div>
                        <div class="flex items-center justify-between mb-2 px-1">
                            <p class="text-[9px] text-gray-500 uppercase tracking-wider font-bold">${esc(opts.labels.detalleLbl)}</p>
                            <p class="text-[9px] text-gray-500 uppercase tracking-wider font-bold">${items.length} ${items.length === 1 ? 'producto' : 'productos'}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div class="overflow-x-auto">${productTable(m)}</div>
                            <div class="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-gray-200">
                                <span class="text-[11px] text-gray-500 uppercase font-bold">${esc(opts.labels.perdidaTot)}</span>
                                <span class="text-xl font-extrabold text-gray-800">-${fmtMoney(totCosto)}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">${esc(opts.labels.evidenciaLbl)}</p>
                        ${fotoHtml(m.foto, editable)}
                    </div>

                    ${m.nota ? `
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">${esc(opts.labels.notaLbl)}</p>
                        <p class="text-[11px] text-gray-700">${esc(m.nota)}</p>
                    </div>` : ''}
                </div>

                <div class="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div class="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                        <span>Unidades</span>
                        <span class="font-semibold text-gray-800">${(totUds % 1 === 0) ? totUds : Number(totUds).toFixed(2)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-600">Total general</span>
                        <span class="text-lg font-bold text-rose-600">-${fmtMoney(totCosto)}</span>
                    </div>
                </div>

                ${actionsBar({ empty: false, cancelled: !editable })}
            `;
        };

        const salidaId  = opts.json ? String(opts.json.id) : '';
        const $prevAside = $(`#${opts.id}`);
        const samePrev   = salidaId !== '' && $prevAside.length && $prevAside.attr('data-salida-id') === salidaId;
        const prevTop    = samePrev ? ($(`#${opts.id}_scroll`).scrollTop() || 0) : 0;

        const aside = $('<aside>', { id: opts.id, class: opts.class, 'data-salida-id': salidaId });
        aside.html(opts.json ? filledView(opts.json) : emptyView());

        $parent.html(aside);
        if (window.lucide) lucide.createIcons();
        if (prevTop) $(`#${opts.id}_scroll`).scrollTop(prevTop);

        if (opts.json) {
            const m = opts.json;
            $(`#${opts.id}_close`).on('click',  () => opts.onClose(m));
            $(`#${opts.id}_print`).on('click',  () => opts.onImprimir(m));
            $(`#${opts.id}_cancel`).on('click', () => opts.onCancelar(m));
            $(`#${opts.id}_delete`).on('click', () => opts.onDelete(m));

            if (m.status !== 'Cancelada') {
                const $input = $(`#${opts.id}_evdInput`);
                $(`#${opts.id}_evdUpload`).on('click', () => $input.trigger('click'));
                $input.on('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    compressImage(file, (dataUrl) => opts.onUploadEvidence(m, dataUrl));
                });
                $(`#${opts.id}_evdRemove`).on('click', (e) => { e.stopPropagation(); opts.onRemoveEvidence(m); });
            }
        }
    }
}
