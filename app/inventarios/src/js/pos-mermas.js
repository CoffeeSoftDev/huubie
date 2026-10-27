let api = 'ctrl/ctrl-pos-mermas.php';
let app, mermas, mermasView;

let turno, subsidiaries_id;

window.updateSession = () => { };

// Config estatica de la vista (titulo, leyendas de motivo). No son datos de negocio.
const VIEW_HEADER_MERMAS = {
    title:    'Visor de Mermas',
    subtitle: 'Control de perdidas por sucursal, motivo y periodo',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const VIEW_FOOTER_MERMAS = {
    info: '',
    legends: [
        { tone: 'danger',  label: 'Caducidad'        },
        { tone: 'warning', label: 'Daniado'          },
        { tone: 'info',    label: 'Error produccion' },
        { tone: 'purple',  label: 'Robo / Faltante'  },
        { tone: 'success', label: 'Devolucion'       }
    ]
};


$(async () => {
    mermasView = new MermasView(api, 'root');
    mermas     = new Mermas(api, 'root');
    app        = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMermas';
        this.subId = null;
    }

    async init() {
        const r = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        if (r && r.status === 200) {
            this.dataInit = {
                subsidiaries_id: r.subsidiaries_id || '',
                sucursales:      r.sucursales      || [],
                motivos:         r.motivos_merma   || [],
                almacenes:       r.almacenes       || [],
                productos:       r.productos       || []
            };
        } else {
            this.dataInit = {
                subsidiaries_id: '',
                sucursales:      [],
                motivos:         [],
                almacenes:       [],
                productos:       []
            };
        }
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        mermasView.renderHeader(VIEW_HEADER_MERMAS, () => mermas.openMermaForm());
        mermasView.renderFooter(VIEW_FOOTER_MERMAS);
        mermasView.renderDetail(null);
        this.populateFilters();
        mermas.lsMermas();
        mermas.lsKpis();
    }

    // -- Layout --

    layout() {

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                
            ]
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class:'w-full md:w-[480px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id:    'emptyDetail',
                    text:  '#emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

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
                id:       'subsidiaries_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-6 col-lg-3',
                onchange: 'app.onChangeFilters()',
                data:     []
            },
            {
                opc:      'select',
                id:       'fMotivo',
                lbl:      'Motivo:',
                class:    'col-12 col-md-6 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data: [
                    { id: '', valor: 'Todos' }
                ]
            },
            {
                opc:       'button',
                id:        'btnNuevaMerma',
                text:      'Nueva Merma',
                color_btn: 'primary',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => mermas.openMermaForm()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'dark',
            data:       filters
        });

        this.initRangePicker();
    }

    // Rango de fechas via bootstrap-daterangepicker sobre #fRango. Default: ultimos 7 dias.
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
            this.populateSelect('subsidiaries_id', sucursales);
            $('#subsidiaries_id').val(this.subId);
        }
        // Motivos del catalogo real: el value es el shrinkage_reason_id (numerico).
        this.populateSelect('fMotivo', this.dataInit.motivos || []);
    }

    populateSelect(id, data) {
        const $sel = $(`#${id}`);
        if (!$sel.length) return;
        $sel.find('option:not(:first)').remove();
        data.forEach(item => {
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            fi:              this.rangeFi               || '',
            ff:              this.rangeFf               || '',
            motivo:          $('#fMotivo').val()        || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        mermas.lsMermas();
        await mermas.lsKpis();
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    renderDetail(merma) {
        mermasView.renderDetail(merma);
    }

    printMerma(id) {
        mermas.printMerma(id);
    }

    cancelMerma(id) {
        mermas.cancelMerma(id);
    }
}

class Mermas extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMermas';
    }

    // -- Data --

    async lsMermas() {
        const f = app.getFilters();
        const r = await fn_ajax(Object.assign({ opc: 'lsMermas' }, {
            subsidiaries_id: f.subsidiaries_id,
            reason_id:       f.motivo,
            fi:              f.fi,
            ff:              f.ff
        }), api).catch(() => null);

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
          
            center:       [1,2, 4, 5,6, 8,9,10],
            right:        [7],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron mermas con los filtros aplicados',
            emptyIcon:    'icon-trash-empty',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;

        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        app.updateFooterInfo(`Mostrando ${total} merma${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await fn_ajax({
            opc:             'showMermas',
            subsidiaries_id: f.subsidiaries_id,
            fi:              f.fi,
            ff:              f.ff
        }, api).catch(() => null);

        const c   = (r && r.status === 200) ? r.counts : {};
        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const kpis = [
            { id: 'kpiMermaHoy',  label: 'Perdida total', value: fmt(c.total_costo),                          tone: 'danger'  },
            { id: 'kpiRegistros', label: 'Registros',     value: parseInt(c.total_mermas    || 0, 10),        tone: 'default' },
            { id: 'kpiUnidades',  label: 'Unidades',      value: parseInt(c.total_unidades  || 0, 10),        tone: 'warning' },
            { id: 'kpiMotivo',    label: 'Motivo top',    value: c.motivo_top || '-',                         tone: 'purple'  }
        ];
        mermasView.renderInfoCards(kpis);
    }

    async getMerma(id) {
        const r = await fn_ajax({ opc: 'getMerma', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            mermasView.renderDetail(this.mapMermaDetail(r.header || {}, r.detail || []));
        } else {
            mermasView.renderDetail(null);
        }
    }

    // Normaliza la respuesta del backend (columnas DB) al shape que espera mermaDetailPanel.
    mapMermaDetail(h, detail) {
        const created = String(h.created_at || '');

        // Cache-buster para la evidencia: al cambiar la foto se reusa el mismo nombre
        // ({folio}.jpg) y misma URL, asi que el navegador mostraria la version cacheada.
        // updated_at cambia justo cuando se actualiza la evidencia -> rompe la cache solo
        // cuando la foto realmente cambio.
        const ev   = h.evidence_url || '';
        const ver  = String(h.updated_at || h.created_at || '').replace(/[^0-9]/g, '');
        const foto = ev ? ev + (ev.indexOf('?') === -1 ? '?' : '&') + 'v=' + ver : '';

        return {
            id:             h.id,
            folio:          h.folio,
            status:         h.status || '',
            motivo:         h.reason_name || '',
            motivo_color:   h.reason_color || '',
            motivo_icon:    h.reason_icon  || '',
            fecha:          created ? created.replace(' ', 'T') : '',
            sucursal:       h.subsidiary_name || '',
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
            total_unidades: Number(h.total_units || 0),
            total_costo:    Number(h.total_cost_loss || 0)
        };
    }

    // -- Actions --

    openMermaForm() {
        // Sucursal por defecto = la seleccionada en el filtro (o la del navbar).
        const curSub = $('#subsidiaries_id').val() || app.subId;
        if (!this.mermaFormApi) {
            this.mermaFormApi = mermasView.mermaForm({
                parent: 'body',
                id:     'mermaFormModal',
                json:   app.dataInit.productos || [],
                data: {
                    motivos:         (app.dataInit.motivos || []).filter(m => m.id !== ''),
                    sucursales:      (app.dataInit.sucursales || []).filter(s => s.id !== ''),
                    almacenes:       app.dataInit.almacenes || [],
                    fecha:           moment().format('YYYY-MM-DD'),
                    subsidiaries_id: curSub
                },
                onSubmit: async (payload) => {
                    const backendPayload = {
                        note:                payload.nota || null,
                        evidence_b64:        payload.photo ? payload.photo.dataUrl : null, // foto como dataURL; el backend la guarda en disco
                        status:              'Aplicada',
                        shrinkage_reason_id: payload.motivo,
                        warehouse_id:        payload.warehouseId,
                        subsidiaries_id:     payload.sucursalId,
                        productos:           payload.items.map(it => ({
                            product_id: it.id,
                            quantity:   it.qty,
                            cost:       it.costo
                        }))
                    };

                    const r = await fn_ajax({
                        opc:     'saveMerma',
                        payload: JSON.stringify(backendPayload)
                    }, api).catch(() => null);

                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || ('Merma ' + r.folio + ' registrada') });
                        this.lsMermas();
                        this.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo registrar la merma' });
                    }
                },
                onClose: () => console.log('[mermaForm] cerrado')
            });
        }
        // Sincroniza la sucursal del navbar (y sus almacenes) en cada apertura.
        this.mermaFormApi.setData({ subsidiaries_id: curSub, fecha: moment().format('YYYY-MM-DD') });
        this.mermaFormApi.open();
    }

    // Genera un comprobante imprimible (formato ticket) de la merma. Acepta el objeto
    // merma ya cargado (lo pasa el panel de detalle) o un id (hace fetch a getMerma).
    async printMerma(arg) {
        let m = arg;
        if (!m || typeof m !== 'object') {
            const r = await fn_ajax({ opc: 'getMerma', id: arg }, api).catch(() => null);
            if (!(r && r.status === 200)) {
                if (typeof alert === 'function') alert({ icon: 'error', text: 'No se pudo cargar la merma para imprimir' });
                return;
            }
            m = this.mapMermaDetail(r.header || {}, r.detail || []);
        }
        this.renderMermaDoc(m);
    }

    // Construye el comprobante de merma como documento tamano carta y lo abre en una
    // ventana nueva (vista de documento, no impresion directa). Incluye boton Imprimir.
    renderMermaDoc(m) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            let   h    = d.getHours();
            const min  = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()} ${h}:${min} ${ampm}`;
        };

        const items = m.items || [];

        // Totales: mismos criterios que el panel de detalle.
        const totals = items.reduce((acc, it) => {
            const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * Number(it.costo_unit || 0);
            acc.uds   += Number(it.qty || 0);
            acc.costo += sub;
            return acc;
        }, { uds: 0, costo: 0 });
        const totUds   = m.total_unidades != null ? m.total_unidades : totals.uds;
        const totCosto = m.total_costo    != null ? m.total_costo    : totals.costo;

        // Agrupa por categoria, igual que el panel.
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
                return `
                    <tr>
                        <td class="prod"><span class="prod-name">${esc(it.name)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td>
                        <td class="c">-${esc(it.qty)}</td>
                        <td class="r">${fmtMoney(cu)}</td>
                        <td class="r">-${fmtMoney(sub)}</td>
                    </tr>`;
            }).join('');
            return head + body;
        }).join('');

        const reg            = m.registrado_por && m.registrado_por.name ? m.registrado_por.name : '-';
        const fechaImpresion = fmtFecha(new Date().toISOString());

        const html = `
            <!doctype html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <title>Merma ${esc(m.folio || '')}</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Segoe UI', Arial, sans-serif; background:#c8c8c8; color:#000; padding:24px; }

                    .toolbar { width:816px; max-width:100%; margin:0 auto 16px; display:flex; justify-content:flex-end; gap:8px; }
                    .btn { cursor:pointer; border:1px solid #000; border-radius:4px; padding:8px 16px; font-size:13px; font-weight:600; color:#fff; background:#333; }
                    .btn:hover { opacity:.85; }
                    .btn.gray { background:#777; }

                    .sheet { width:816px; max-width:100%; min-height:1056px; margin:0 auto; background:#fff; padding:40px 48px; box-shadow:0 2px 10px rgba(0,0,0,.25); }

                    .doc-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:18px; }
                    .doc-title { font-size:22px; font-weight:800; letter-spacing:.5px; color:#000; }
                    .doc-sub { font-size:12px; color:#555; margin-top:3px; }
                    .folio-box { text-align:right; }
                    .folio { font-size:20px; font-weight:800; color:#000; }
                    .status { display:inline-block; margin-top:6px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:2px 10px; border:1px solid #000; border-radius:3px; color:#000; }

                    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 40px; margin-bottom:18px; }
                    .info-item { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #ccc; padding-bottom:4px; font-size:12px; }
                    .info-item .k { color:#555; }
                    .info-item .v { font-weight:700; text-align:right; color:#000; }

                    table { width:100%; border-collapse:collapse; margin-bottom:18px; }
                    thead th { border-bottom:1.5px solid #000; font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#000; padding:4px 8px; text-align:left; }
                    thead th.r { text-align:right; }
                    thead th.c { text-align:center; }
                    tbody td { padding:3px 8px; font-size:11px; line-height:1.25; border-bottom:1px solid #e2e2e2; vertical-align:top; color:#000; }
                    tbody td.r { text-align:right; white-space:nowrap; }
                    tbody td.c { text-align:center; white-space:nowrap; }
                    tr.cat td { background:#efefef; font-weight:700; text-transform:uppercase; font-size:10px; color:#000; letter-spacing:.5px; padding:3px 8px; border-top:1px solid #000; }
                    tr.cat .cat-count { float:right; color:#666; font-weight:600; }
                    .prod-name { font-weight:600; }
                    .sku { color:#777; font-size:10px; }

                    .totals { display:flex; justify-content:flex-end; }
                    .totals-box { width:280px; border:1px solid #000; border-radius:4px; padding:10px 14px; }
                    .totals-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; color:#000; }
                    .totals-row.grand { border-top:1.5px solid #000; margin-top:4px; padding-top:8px; font-size:16px; font-weight:800; color:#000; }

                    .nota { margin-top:18px; border-left:3px solid #000; background:#f7f7f7; padding:10px 14px; font-size:12px; color:#222; }
                    .nota b { display:block; margin-bottom:3px; text-transform:uppercase; font-size:10px; letter-spacing:.5px; color:#555; }

                    .doc-footer { margin-top:28px; display:flex; justify-content:space-between; font-size:10px; color:#777; border-top:1px solid #ccc; padding-top:10px; }

                    @page { size:letter; margin:1.4cm; }
                    @media print {
                        body { background:#fff; padding:0; }
                        .toolbar { display:none; }
                        .sheet { width:auto; min-height:auto; box-shadow:none; padding:0; }
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <button class="btn" onclick="window.print()">Imprimir</button>
                    <button class="btn gray" onclick="window.close()">Cerrar</button>
                </div>
                <div class="sheet">
                    <div class="doc-header">
                        <div>
                            <div class="doc-title">Comprobante de Merma</div>
                            <div class="doc-sub">${esc(m.sucursal || '')}${m.almacen ? ' &middot; ' + esc(m.almacen) : ''}</div>
                        </div>
                        <div class="folio-box">
                            <div class="folio">${esc(m.folio || '-')}</div>
                            ${m.status ? `<span class="status">${esc(m.status)}</span>` : ''}
                        </div>
                    </div>

                    <div class="info-grid">
                        <div class="info-item"><span class="k">Motivo</span><span class="v">${esc(m.motivo || '-')}</span></div>
                        <div class="info-item"><span class="k">Fecha</span><span class="v">${esc(fmtFecha(m.fecha))}</span></div>
                        <div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(m.sucursal || '-')}</span></div>
                        <div class="info-item"><span class="k">Almacen</span><span class="v">${esc(m.almacen || '-')}</span></div>
                        <div class="info-item"><span class="k">Registrado por</span><span class="v">${esc(reg)}</span></div>
                        <div class="info-item"><span class="k">Productos</span><span class="v">${items.length} tipos &middot; ${totUds} uds</span></div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th class="c">Cant</th>
                                <th class="r">Costo unit.</th>
                                <th class="r">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml || `<tr><td colspan="4" class="c">Sin productos</td></tr>`}</tbody>
                    </table>

                    <div class="totals">
                        <div class="totals-box">
                            <div class="totals-row"><span>Tipos de producto</span><span>${items.length}</span></div>
                            <div class="totals-row"><span>Unidades</span><span>${totUds}</span></div>
                            <div class="totals-row grand"><span>Perdida total</span><span>-${fmtMoney(totCosto)}</span></div>
                        </div>
                    </div>

                    ${m.nota ? `<div class="nota"><b>Nota</b>${esc(m.nota)}</div>` : ''}

                    <div class="doc-footer">
                        <span>Huubie &middot; Inventarios &middot; Comprobante de merma</span>
                        <span>Generado: ${esc(fechaImpresion)}</span>
                    </div>
                </div>
            </body>
            </html>
        `;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Permite las ventanas emergentes para poder ver el documento.' });
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    cancelMerma(id) {
        const doCancel = async () => {
            const r = await fn_ajax({ opc: 'cancelMerma', id: id }, api).catch(() => null);
            if (r && r.status === 200) {
                alert({ icon: 'success', text: 'Merma ' + id + ' cancelada' });
                mermasView.renderDetail(null);
                this.lsMermas();
                this.lsKpis();
            } else {
                alert({ icon: 'error', text: (r && r.message) || 'No se pudo cancelar' });
            }
        };

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¿Cancelar esta merma?',
                text:  'El stock de los productos sera restaurado. Accion irreversible.',
                icon:  'warning',
                showCancelButton:  true,
                confirmButtonText: 'Si, cancelar',
                cancelButtonText:  'No'
            }).then((r) => { if (r.isConfirmed) doCancel(); });
        } else {
            doCancel();
        }
    }

    // Elimina un formato ya cancelado (soft-delete en backend) desde el visor.
    deleteMerma(id) {
        const doDelete = async () => {
            const r = await fn_ajax({ opc: 'deleteMerma', id: id }, api).catch(() => null);
            if (r && r.status === 200) {
                alert({ icon: 'success', text: r.message || 'Merma eliminada' });
                mermasView.renderDetail(null);
                this.lsMermas();
                this.lsKpis();
            } else {
                alert({ icon: 'error', text: (r && r.message) || 'No se pudo eliminar' });
            }
        };

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¿Eliminar esta merma?',
                text:  'El formato cancelado se quitara del visor. Accion irreversible.',
                icon:  'warning',
                showCancelButton:  true,
                confirmButtonText: 'Si, eliminar',
                cancelButtonText:  'No'
            }).then((r) => { if (r.isConfirmed) doDelete(); });
        } else {
            doDelete();
        }
    }

    // Sube o reemplaza la evidencia fotografica (dataURL ya comprimido por el panel).
    async uploadEvidence(id, dataUrl) {
        if (!dataUrl) return;
        const r = await fn_ajax({ opc: 'saveMermaEvidence', id: id, evidence_b64: dataUrl }, api).catch(() => null);
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Evidencia actualizada' });
            this.getMerma(id);
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo guardar la evidencia' });
        }
    }

    // Quita la evidencia fotografica (envia b64 vacio para que el backend la borre).
    removeEvidence(id) {
        const doRemove = async () => {
            const r = await fn_ajax({ opc: 'saveMermaEvidence', id: id, evidence_b64: '' }, api).catch(() => null);
            if (r && r.status === 200) {
                if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Evidencia eliminada' });
                this.getMerma(id);
            } else {
                if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo eliminar la evidencia' });
            }
        };

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¿Quitar evidencia?',
                text:  'Se eliminara la foto de evidencia de esta merma.',
                icon:  'warning',
                showCancelButton:  true,
                confirmButtonText: 'Si, quitar',
                cancelButtonText:  'No'
            }).then((r) => { if (r.isConfirmed) doRemove(); });
        } else {
            doRemove();
        }
    }
}

class MermasView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMermas';
    }

    // -- Render helpers --

    renderDetail(merma) {
        this.mermaDetailPanel({
            parent:           'detailPanel',
            json:             merma,
            onClose:          ()  => this.renderDetail(null),
            onImprimir:       (m) => { if (m) mermas.printMerma(m); },
            onCancelar:       (m) => { if (m) mermas.cancelMerma(m.id); },
            onDelete:         (m) => { if (m) mermas.deleteMerma(m.id); },
            onUploadEvidence: (m, dataUrl) => { if (m) mermas.uploadEvidence(m.id, dataUrl); },
            onRemoveEvidence: (m) => { if (m) mermas.removeEvidence(m.id); }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data, onNueva) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value),
            onNueva:  onNueva || (() => { })
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-4 gap-3',
            json:   [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)]  rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
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

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:     'text-base font-bold text-white',
                subtitle:  'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl:  'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:       'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive: 'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-danger,#E02424)] bg-[var(--cs-danger,#E02424)]/15 text-white',
                sep:       'text-[var(--cs-border,#374151)]',
                backBtn:   'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-danger,#E02424)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-danger,#E02424)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onNueva:  () => { },
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

    mermaDetailPanel(options) {

        // -- Config --

        const defaults = {
            parent:   'root',
            id:       'mermaDetailPanel',
            class:    'w-full h-full flex-shrink-0 bg-[#141d2b] flex flex-col overflow-hidden',
            json:     null,
            labels: {
                emptyTitle:  'Selecciona una merma',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de la perdida',
                motivo:      'Motivo',
                sucursal:    'Sucursal',
                almacen:     'Almacén',
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
                folioPrefix: 'Merma'
            },
            motivoPalettes: {
                'Caducidad':        { bg: 'rgba(224,36,36,0.18)',  fg: '#F87171', icon: 'calendar-x'     },
                'Daniado':          { bg: 'rgba(251,191,36,0.18)', fg: '#FBBF24', icon: 'alert-triangle' },
                'Dañado':           { bg: 'rgba(251,191,36,0.18)', fg: '#FBBF24', icon: 'alert-triangle' },
                'Error produccion': { bg: 'rgba(28,100,242,0.18)', fg: '#60A5FA', icon: 'settings'       },
                'Error producción': { bg: 'rgba(28,100,242,0.18)', fg: '#60A5FA', icon: 'settings'       },
                'Robo/Faltante':    { bg: 'rgba(124,58,237,0.18)', fg: '#A78BFA', icon: 'shield-alert'   },
                'Robo / Faltante':  { bg: 'rgba(124,58,237,0.18)', fg: '#A78BFA', icon: 'shield-alert'   },
                'Devolucion':       { bg: 'rgba(63,193,137,0.18)', fg: '#3FC189', icon: 'rotate-ccw'     },
                'Devolución':       { bg: 'rgba(63,193,137,0.18)', fg: '#3FC189', icon: 'rotate-ccw'     }
            },
            // Paleta del badge de estado (cabecera): Aplicada -> verde, Cancelada -> rojo.
            statusPalettes: {
                'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Cancelada': { bg: 'rgba(224,36,36,0.15)',  fg: '#F87171' }
            },
            sucursalLabels: {
                kafeto:     'Reginas Kafeto',
                central:    'Reginas Central',
                pasteleria: 'Reginas Pasteleria'
            },
            onClose:          () => { },
            onImprimir:       () => { },
            onCancelar:       () => { },
            onDelete:         () => { },
            onUploadEvidence: () => { },
            onRemoveEvidence: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.motivoPalettes = Object.assign({}, defaults.motivoPalettes, o.motivoPalettes || {});
        opts.statusPalettes = Object.assign({}, defaults.statusPalettes, o.statusPalettes || {});
        opts.sucursalLabels = Object.assign({}, defaults.sucursalLabels, o.sucursalLabels || {});

        // -- Helpers de formato --

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Convierte un color #RRGGBB (color_hex de la BD) a rgba con la opacidad dada,
        // para reproducir el fondo translucido del badge sin depender de la paleta fija.
        const hexToRgba = (hex, a) => {
            const h = String(hex || '').trim().replace('#', '');
            if (h.length !== 6) return '';
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            if ([r, g, b].some(isNaN)) return '';
            return `rgba(${r},${g},${b},${a})`;
        };

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const dow  = DOW[d.getDay()];
            const day  = String(d.getDate()).padStart(2, '0');
            const mon  = MON[d.getMonth()];
            const year = d.getFullYear();
            let   h    = d.getHours();
            const m    = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${dow} ${day} ${mon} ${year} · ${h}:${m} ${ampm}`;
        };

        // Redimensiona a max 1280px y recomprime a JPEG (mismo criterio que merma-form):
        // una foto de camara pesa varios MB y su base64 excederia el post_max_size de PHP.
        const compressImage = (file, cb) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const max = 1280;
                    let w = img.width, h = img.height;
                    if (w > max || h > max) {
                        const scale = max / Math.max(w, h);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    cb(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => cb(ev.target.result); // fallback: dataURL original
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };

        // -- Bloques de UI --

        // Botonera inferior, sin borde. En vacio ambos botones quedan desactivados.
        // Si la merma esta cancelada, el segundo boton pasa de "Cancelar" a "Eliminar".
        const actionsBar = (state) => {
            const s         = state || {};
            const empty     = !!s.empty;
            const cancelled = !!s.cancelled;
            const base      = 'flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5';
            const off       = 'opacity-40 cursor-not-allowed';
            const roseHover = empty ? off : 'hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/20 transition-all';

            const secondBtn = cancelled
                ? `<button id="${opts.id}_delete" class="${base} bg-rose-600 ${roseHover}">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.eliminar)}
                    </button>`
                : `<button id="${opts.id}_cancel" ${empty ? 'disabled' : ''} class="${base} bg-rose-600 ${roseHover}">
                        <i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.cancelar)}
                    </button>`;

            return `
                <div class="px-4 py-3 flex gap-2 flex-shrink-0">
                    <button id="${opts.id}_print" ${empty ? 'disabled' : ''} class="${base} bg-sky-600 ${empty ? off : 'hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-500/20 transition-all'}">
                        <i data-lucide="printer" class="w-3.5 h-3.5"></i>${esc(opts.labels.imprimir)}
                    </button>
                    ${secondBtn}
                </div>`;
        };

        // Estado vacio: sin merma seleccionada.
        const emptyView = () => `
            <div class="px-3 py-3 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-white">Vista de la Merma</h3>
                    <p class="text-[10px] text-[#9CA3AF]">${esc(opts.labels.subtitleLbl)}</p>
                </div>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div class="w-14 h-14 rounded-full bg-[#1F2937] flex items-center justify-center mb-3">
                    <i data-lucide="package-x" class="w-6 h-6 text-[#9CA3AF]"></i>
                </div>
                <p class="text-[11px] text-[#9CA3AF]">${esc(opts.labels.emptyTitle)}</p>
                <p class="text-[10px] text-[#9CA3AF] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
            </div>
            ${actionsBar({ empty: true })}
        `;

        // Detalle de productos en formato tabla (solo lectura), agrupado por categoria.
        const productTable = (m) => {
            const items = m.items || [];

            // Agrupa por categoria y ordena los grupos alfabeticamente, igual que el
            // formulario de captura (merma-form renderProductsTable).
            const byCat = {};
            items.forEach(it => {
                const cat = (it.categoria && String(it.categoria).trim()) || 'Sin categoria';
                (byCat[cat] = byCat[cat] || { categoria: cat, items: [] }).items.push(it);
            });
            const groups = Object.keys(byCat)
                .sort((a, b) => a.localeCompare(b, 'es'))
                .map(c => byCat[c]);

            const itemRow = (it) => {
                const costoUnit = Number(it.costo_unit || 0);
                const subtotal  = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * costoUnit;
                return `
                    <tr>
                        <td class="py-1 px-1">
                            <p class="text-[11px] font-semibold text-white leading-tight">${esc(it.name)}</p>
                            ${it.sku ? `<p class="text-[10px] text-[#9CA3AF] leading-tight">${esc(it.sku)}</p>` : ''}
                        </td>
                        <td class="py-1 px-1 text-center whitespace-nowrap"><span class="text-rose-400 font-bold">-${it.qty}</span></td>
                        <td class="py-1 px-1 text-right text-white whitespace-nowrap">${fmtMoney(costoUnit)}</td>
                        <td class="py-1 px-1 text-right text-white font-bold whitespace-nowrap">-${fmtMoney(subtotal)}</td>
                    </tr>`;
            };

            // Encabezado de categoria con el mismo formato que el formulario de captura
            // (merma-form renderLoteCatRow): etiqueta morada en mayusculas + conteo.
            const groupBlock = (g) => {
                const head = `
                    <tr>
                        <td colspan="4" class="px-2 pt-1.5 pb-0.5 bg-indigo-500/10">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-300 truncate">${esc(g.categoria)}</span>
                                <span class="text-[10px] text-gray-500 flex-shrink-0 ml-2">${g.items.length}</span>
                            </div>
                        </td>
                    </tr>`;
                return head + g.items.map(itemRow).join('');
            };

            const rows = groups.map(groupBlock).join('');

            return `
                <table class="w-full text-[11px] border-collapse">
                    <thead>
                        <tr class="text-[10px] text-[#9CA3AF] uppercase tracking-wider">
                            <th class="py-1 px-1 text-left font-semibold">Producto</th>
                            <th class="py-1 px-1 text-center font-semibold">${esc(opts.labels.cant)}</th>
                            <th class="py-1 px-1 text-right font-semibold">${esc(opts.labels.costo)}</th>
                            <th class="py-1 px-1 text-right font-semibold">${esc(opts.labels.subtotal)}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || `<tr><td colspan="4" class="py-2 text-center text-[12px] text-gray-500 italic">Sin productos</td></tr>`}</tbody>
                </table>`;
        };

        // Foto de evidencia (propia de mermas). Si la merma no esta cancelada (editable),
        // permite subir, cambiar o quitar la foto; cancelada -> solo lectura.
        const fotoHtml = (foto, editable) => {
            const inputHtml = editable
                ? `<input type="file" id="${opts.id}_evdInput" accept="image/*" capture="environment" class="hidden">`
                : '';

            // Sin foto.
            if (!foto) {
                if (!editable) {
                    return `
                        <div class="bg-[#1F2937] rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px]">
                            <i data-lucide="image-off" class="w-7 h-7 text-[#374151] mb-2"></i>
                            <p class="text-[10px] text-[#9CA3AF] italic">${esc(opts.labels.sinFoto)}</p>
                        </div>`;
                }
                return `
                    ${inputHtml}
                    <button type="button" id="${opts.id}_evdUpload"
                            class="w-full bg-[#1F2937] rounded-lg p-4 hover:border-sky-500/60 flex flex-col items-center justify-center min-h-[100px] transition-colors group">
                        <i data-lucide="upload-cloud" class="w-7 h-7 text-[#9CA3AF] group-hover:text-sky-400 mb-2"></i>
                        <p class="text-[10px] text-[#9CA3AF] group-hover:text-white">${esc(opts.labels.subirFoto)}</p>
                    </button>`;
            }

            // Con foto, solo lectura (cancelada).
            if (!editable) {
                return `
                    <div class="rounded-lg overflow-hidden">
                        <img src="${esc(foto)}" alt="Evidencia" class="w-full h-32 object-cover" />
                    </div>`;
            }

            // Con foto, editable: barra de acciones SIEMPRE visible (descubrible en
            // tablet/tactil, no solo al hover) -> cambiar / quitar.
            const btnBase = 'px-2 py-1 text-[10px] font-semibold text-white rounded-md flex items-center gap-1 transition-colors';
            return `
                ${inputHtml}
                <div class="relative rounded-lg overflow-hidden">
                    <img src="${esc(foto)}" alt="Evidencia" class="w-full h-32 object-cover" />
                    <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center justify-end gap-1.5">
                        <button type="button" id="${opts.id}_evdUpload" class="${btnBase} bg-sky-600/90 hover:bg-sky-500">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i>${esc(opts.labels.cambiarFoto)}
                        </button>
                        <button type="button" id="${opts.id}_evdRemove" class="${btnBase} bg-rose-600/90 hover:bg-rose-500">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>${esc(opts.labels.quitarFoto)}
                        </button>
                    </div>
                </div>`;
        };

        // Estado con merma: cabecera + resumen + productos + evidencia + nota + botonera.
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
            const sucursal = opts.sucursalLabels[m.sucursal] || m.sucursal || '-';
            const almacen  = m.almacen || '-';

            // Color e icono del motivo: prioriza la configuracion de la BD (color_hex/icon
            // de shrinkage_reason); si no llega, cae a la paleta fija por nombre.
            const motivoC     = opts.motivoPalettes[m.motivo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF', icon: 'alert-triangle' };
            const motivoBg    = hexToRgba(m.motivo_color, 0.18) || motivoC.bg;
            const motivoFg    = m.motivo_color || motivoC.fg;
            const motivoIcon  = m.motivo_icon  || motivoC.icon || 'alert-triangle';
            const motivoBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:${motivoBg};color:${motivoFg};"><i data-lucide="${esc(motivoIcon)}" class="w-3 h-3"></i>${esc(m.motivo || '-')}</span>`;

            // Badge de estado en la cabecera (Aplicada / Cancelada).
            const stC         = opts.statusPalettes[m.status] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
            const statusBadge = m.status
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style="background:${stC.bg};color:${stC.fg};">${esc(m.status)}</span>`
                : '';

            // Registrado por: avatar circular con la inicial + nombre.
            const reg        = m.registrado_por;
            const regName    = reg && reg.name ? esc(reg.name) : '-';
            const regInitial = reg && reg.name ? esc(String(reg.name).trim().charAt(0).toUpperCase()) : '?';
            const regHtml    = reg && reg.name
                ? `<span class="flex items-center gap-1.5">
                        <span class="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">${regInitial}</span>
                        <span class="text-white font-semibold">${regName}</span>
                   </span>`
                : `<span class="text-white">-</span>`;

            // La evidencia solo se puede subir/quitar mientras la merma no este cancelada.
            const editable = m.status !== 'Cancelada';

            return `
                <div class="px-3 py-3 flex-shrink-0 flex items-start justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-base font-bold text-white">${esc(opts.labels.folioPrefix)} ${esc(m.folio || '')}</h3>
                            ${statusBadge}
                        </div>
                        <p class="text-[10px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                            <i data-lucide="clock" class="w-3 h-3"></i>${esc(fmtFecha(m.fecha))}
                        </p>
                    </div>
                    <button id="${opts.id}_close" class="text-[#D1D5DB] hover:text-white transition-colors p-1 flex-shrink-0" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div id="${opts.id}_scroll" class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-3">

                    <!-- Resumen -->
                    <div class="bg-[#1F2937] rounded-lg p-3 space-y-2.5">
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.motivo)}</span>
                            ${motivoBadge}
                        </div>
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.sucursal)}</span>
                            <span class="text-white font-bold">${esc(sucursal)}</span>
                        </div>
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.almacen)}</span>
                            <span class="text-white font-bold">${esc(almacen)}</span>
                        </div>
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.registrado)}</span>
                            ${regHtml}
                        </div>
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.productos)}</span>
                            <span class="text-white font-bold">${items.length} tipos · ${totUds} uds</span>
                        </div>
                    </div>

                    <!-- Detalle de productos -->
                    <div>
                        <div class="flex items-center justify-between mb-2 px-1">
                            <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider font-bold">${esc(opts.labels.detalleLbl)}</p>
                            <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider font-bold">${items.length} ${items.length === 1 ? 'producto' : 'productos'}</p>
                        </div>
                        <div class="bg-[#1F2937] rounded-lg p-2">
                            <div class="overflow-x-auto">${productTable(m)}</div>
                            <!-- Perdida total debajo de la tabla -->
                            <div class="flex items-center justify-between mt-2 pt-2">
                                <span class="text-[11px] text-[#9CA3AF] uppercase font-bold">${esc(opts.labels.perdidaTot)}</span>
                                <span class="text-xl font-extrabold text-white">-${fmtMoney(totCosto)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Evidencia -->
                    <div>
                        <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-2">${esc(opts.labels.evidenciaLbl)}</p>
                        ${fotoHtml(m.foto, editable)}
                    </div>

                    <!-- Nota -->
                    ${m.nota ? `
                    <div class="bg-[#1F2937] rounded-lg p-3">
                        <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-1">${esc(opts.labels.notaLbl)}</p>
                        <p class="text-[11px] text-gray-300">${esc(m.nota)}</p>
                    </div>` : ''}
                </div>

                ${actionsBar({ empty: false, cancelled: !editable })}
            `;
        };

        // -- Construccion e insercion al DOM --

        const mermaId = opts.json ? String(opts.json.id) : '';
        const aside   = $('<aside>', { id: opts.id, class: opts.class, 'data-merma-id': mermaId });
        aside.html(opts.json ? filledView(opts.json) : emptyView());

        // Preserva el scroll interno SOLO si re-renderizamos la misma merma (subir/cambiar/
        // quitar evidencia reconstruye el panel; sin esto el contenedor saltaria al inicio).
        const $prevAside = $(`#${opts.id}`);
        const samePrev   = mermaId !== '' && $prevAside.length && $prevAside.attr('data-merma-id') === mermaId;
        const prevTop    = samePrev ? ($(`#${opts.id}_scroll`).scrollTop() || 0) : 0;

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        if (prevTop) $(`#${opts.id}_scroll`).scrollTop(prevTop);

        // -- Eventos (solo con merma seleccionada) --

        if (opts.json) {
            const m = opts.json;
            $(`#${opts.id}_close`).on('click',  () => opts.onClose(m));
            $(`#${opts.id}_print`).on('click',  () => opts.onImprimir(m));
            $(`#${opts.id}_cancel`).on('click', () => opts.onCancelar(m));
            $(`#${opts.id}_delete`).on('click', () => opts.onDelete(m));

            // Evidencia editable: subir/cambiar dispara el input file; el archivo se
            // comprime antes de mandarlo. Quitar va directo al callback.
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
