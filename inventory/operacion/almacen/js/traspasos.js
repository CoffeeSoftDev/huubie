let api = 'ctrl/ctrl-traspasos.php';
let app, traspasos, traspasosView;

let branchId;

const VIEW_HEADER_TRASPASOS = {
    title:    'Visor de Traspasos',
    subtitle: 'Gestion de movimientos entre sucursales',
    // back:     { href: '/inventory/operacion/almacen/index.php', title: 'Regresar al inicio' }
};

$(async () => {
    traspasosView = new TraspasosView(api, 'root');
    traspasos     = new Traspasos(api, 'root');
    app           = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Traspasos';
        this.branchId     = null;
        this.selectedId   = null;
        this.dataInit     = {};
    }

    async init() {
        const r  = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.dataInit = {
            branch_id:   ok ? (r.branch_id   || '') : '',
            sucursales:  ok ? (r.sucursales   || []) : [],
            estados:     ok ? (r.estados_traspaso || []) : [],
            almacenes:   ok ? (r.almacenes    || []) : [],
            companiesId: ok ? (r.companies_id || 0)  : 0
        };

        this.branchId = this.dataInit.branch_id;
        branchId      = this.branchId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderHeader();
        traspasosView.renderDetail(null);
        traspasos.lsTraspasos();
        traspasos.lsKpis();
    }

    renderHeader() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const branch     = (this.dataInit.sucursales || []).find(s => String(s.id) === String(this.branchId));
        const branchName = branch ? (branch.valor || '') : '';

        const titleHtml = branchName
            ? `${VIEW_HEADER_TRASPASOS.title} <span class="font-bold" style="color:#C05A40;">&middot; ${esc(branchName)}</span>`
            : VIEW_HEADER_TRASPASOS.title;

        traspasosView.renderHeader(Object.assign({}, VIEW_HEADER_TRASPASOS, { titleHtml }));
    }

    layout() {
        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[400px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden',
            children: [
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'flex-1 flex flex-col overflow-hidden'
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
        const withAll = (list, label) => {
            const arr = list || [];
            return (arr[0] && (arr[0].id === '' || arr[0].id == null))
                ? arr
                : [{ id: '', valor: label }].concat(arr);
        };
        const sucursales = withAll(this.dataInit.sucursales, 'Todas las sucursales');

        // Estados relativos a mi sucursal (lo que envio vs lo que recibo).
        const estados = [
            { id: '',            valor: 'Todos los estados' },
            { id: 'enviados',    valor: 'Enviados' },
            { id: 'por_recibir', valor: 'Por recibir' },
            { id: 'entregados',  valor: 'Entregados' },
            { id: 'recibidos',   valor: 'Recibidos' },
            { id: 'rechazados',  valor: 'Rechazados' }
        ];

        const filters = [
            {
                opc:   'input-calendar',
                id:    `calendar${this.PROJECT_NAME}`,
                lbl:   'Rango de fecha:',
                class: 'col-12 col-md-3 col-lg-3'
            },
            {
                opc: 'select',
                id: 'fDestino',
                lbl: 'Destino:',
                class: 'col-12 col-md-2 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value: '',
                data: sucursales
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-2 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     estados
            },
           
            {
                opc:       'button',
                id:        'btnNuevoTraspaso',
                text:      'Nuevo Traspaso',
                color_btn: 'invernal',
                class:     'col-12 col-md-2 col-lg-3',
                onClick:   () => traspasosView.openTraspasoForm()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        dataPicker({
            parent: `calendar${this.PROJECT_NAME}`,
            rangepicker: {
                startDate:     moment().startOf('month'),
                endDate:       moment().endOf('month'),
                showDropdowns: true,
                ranges: {
                    'Hoy':           [moment(), moment()],
                    'Ayer':          [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Semana actual': [moment().startOf('week'), moment().endOf('week')],
                    'Mes actual':    [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':  [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                }
            },
            onSelect: () => this.onChangeFilters()
        });
    }

    getFilters() {
        const range = getDataRangePicker(`calendar${this.PROJECT_NAME}`) || {};
        return {
            branch_id:   this.branchId || '',
            scope:       this.branchId  || '',
            relative:    $('#fEstado').val()  || '',
            destino:     $('#fDestino').val() || '',
            fechaIni:    range.fi             || '',
            fechaFin:    range.ff             || '',
            q:           $('#qBuscar').val()  || ''
        };
    }

    async onChangeFilters() {
        traspasos.lsTraspasos();
        await traspasos.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTraspaso(null);
        }
    }

    filterByKpi(kpi) {
        const rel     = (kpi && kpi.rel) || '';
        const current = $('#fEstado').val() || '';
        $('#fEstado').val(current === rel ? '' : rel);
        this.onChangeFilters();
    }

    onBranchChange(detail) {
        if (detail && detail.id != null) {
            this.branchId = detail.id;
            branchId      = this.branchId;
        }
        this.renderHeader();
        this.selectTraspaso(null);
        traspasos.lsTraspasos();
        traspasos.lsKpis();
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    selectTraspaso(folio, id) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
        }
        if (id) {
            traspasos.getTraspaso(id);
        } else {
            traspasosView.renderDetail(null);
        }
    }
}


class Traspasos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Traspasos';
    }

    lsTraspasos() {
        const f = app.getFilters();

        this.createTable({
            parent:      'tableWrap',
            idFilterBar: 'filterBar',
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            data: {
                opc:                  'lsTraspasos',
                relative:             f.relative,
                scope_branch_id:      f.scope,
                destination_branch_id: f.destino,
                fi:                   f.fechaIni,
                ff:                   f.fechaFin,
                q:                    f.q
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                f_size:       12,
                center:       [1, 3, 4, 5, 10],
                right:        [6],
                emptyMessage: 'No se encontraron traspasos con los filtros aplicados',
                emptyIcon:    'icon-arrow-left-right'
            }
        });
    }

    async lsKpis() {
        const r = await fn_ajax({
            opc:             'showTraspasos',
            scope_branch_id: app.branchId || ''
        }, api).catch(() => null);
        const c = (r && r.status === 200) ? r.counts : {};

        const kpiValue = (n) => {
            const v = parseInt(n || 0, 10);
            return v === 0 ? '-' : v;
        };

        const kpis = [
            { id: 'kpiTotal',      label: 'Total Mes',   value: kpiValue(c.total),       tone: 'default', rel: '' },
            { id: 'kpiEnviados',   label: 'Enviados',    value: kpiValue(c.enviados),    tone: 'warning', rel: 'enviados' },
            { id: 'kpiPorRecibir', label: 'Por recibir', value: kpiValue(c.por_recibir), tone: 'info',    rel: 'por_recibir' },
            { id: 'kpiEntregados', label: 'Entregados',  value: kpiValue(c.entregados),  tone: 'success', rel: 'entregados' },
            { id: 'kpiRecibidos',  label: 'Recibidos',   value: kpiValue(c.recibidos),   tone: 'success', rel: 'recibidos' },
            { id: 'kpiRechazados', label: 'Rechazados',  value: kpiValue(c.rechazados),  tone: 'danger',  rel: 'rechazados' }
        ];

        const current     = $('#fEstado').val() || '';
        const match       = kpis.find(k => (k.rel || '') === current);
        const activeKpiId = match ? match.id : '';

        traspasosView.renderInfoCards(kpis, activeKpiId);
    }

    async getTraspaso(id) {
        const r = await fn_ajax({ opc: 'getTraspaso', id: id, scope_branch_id: app.branchId || '' }, api).catch(() => null);
        if (r && r.status === 200) {
            traspasosView.renderDetail(
                this.mapTraspasoDetail(r.header || {}, r.detail || [], r.history || [])
            );
        } else {
            traspasosView.renderDetail(null);
        }
    }

    mapTraspasoDetail(h, detail, history) {
        const toIso = (s) => s ? String(s).replace(' ', 'T') : '';

        return {
            id:         h.id,
            folio:      h.folio,
            estado:      h.relative_status_name || h.status_name || '',
            statusCode:  h.status_code || '',
            estadoColor: h.status_color || '',
            estadoBg:    h.status_bg    || '',
            fechaIso:   toIso(h.date_request),
            fechaEnvio: toIso(h.date_sent),
            solicito:   h.requested_user_name || '',
            recibio:    h.received_by_name    || '',
            recibioUser: h.received_user_name || '',
            nota:       h.note || '',
            origen: {
                id:      h.origin_branch_id != null ? String(h.origin_branch_id) : '',
                nombre:  h.origin_branch_name  || '-',
                almacen: h.origin_warehouse_name || ''
            },
            destino: {
                id:      h.destination_branch_id != null ? String(h.destination_branch_id) : '',
                nombre:  h.destination_branch_name  || '-',
                almacen: h.destination_warehouse_name || ''
            },
            productos: (detail || []).map(d => ({
                nombre: d.item_name || '',
                sku:    d.sku || '',
                cant:   Number(d.quantity || 0),
                costo:  Number(d.cost || 0)
            })),
            timeline: (history || []).map(x => ({
                estado:   x.status_name || '',
                usuario:  x.user_name   || '',
                fechaIso: toIso(x.transitioned_at)
            }))
        };
    }

    async nuevoTraspaso(payload) {
        const origen  = payload.origen  || {};
        const destino = payload.destino || {};

        const backendPayload = {
            note:                     payload.nota || null,
            origin_branch_id:         origen.id,
            destination_branch_id:    destino.id,
            origin_warehouse_id:      (origen.almacen  || {}).id,
            destination_warehouse_id: (destino.almacen || {}).id,
            productos: (payload.productos || []).map(p => ({
                item_id:  p.productId,
                quantity: p.cant,
                cost:     p.costo
            }))
        };

        const r = await fn_ajax({
            opc:     'saveTraspaso',
            payload: JSON.stringify(backendPayload)
        }, api).catch(() => null);

        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso ' + r.folio + ' solicitado' });
            this.lsTraspasos();
            this.lsKpis();
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo crear el traspaso' });
        }
    }

    confirmTraspaso(id) {
        app.alertBox({
            type:             'confirm',
            icon:             'check-circle',
            iconBg:           'bg-green-50',
            iconColor:        'text-green-600',
            title:            'Aceptar envio',
            detailHtml:       'Confirma la recepcion del traspaso.',
            input:            'text',
            inputLabel:       'Quien recibe el traspaso?',
            inputPlaceholder: 'Nombre de quien recibe',
            inputRequired:    true,
            inputError:       'Indica quien recibe el traspaso',
            okLabel:          'Aceptar y recibir',
            okBg:             'bg-green-600 hover:bg-green-500',
            cancelLabel:      'Cancelar',
            onOk: async (receivedBy) => {
                const r = await fn_ajax({
                    opc:         'confirmTraspaso',
                    id:          id,
                    received_by: receivedBy
                }, api).catch(() => null);

                if (r && r.status === 200) {
                    app.alertBox({ type: 'success', title: 'Traspaso recibido', timer: 2200 });
                    this.lsTraspasos();
                    this.lsKpis();
                    traspasosView.renderDetail(null);
                } else {
                    app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo confirmar' });
                }
            }
        });
    }

    rejectTraspaso(id) {
        app.alertBox({
            type:             'cancel',
            title:            'Rechazar envio?',
            detailHtml:       'El traspaso se marcara como rechazado. Accion irreversible.',
            input:            'textarea',
            inputLabel:       'Motivo del rechazo (opcional)',
            inputPlaceholder: 'Indica por que se rechaza el traspaso',
            okLabel:          'Sí, rechazar',
            cancelLabel:      'No',
            onOk: async (reason) => {
                const r = await fn_ajax({
                    opc:  'rejectTraspaso',
                    id:   id,
                    note: reason || ''
                }, api).catch(() => null);

                if (r && r.status === 200) {
                    app.alertBox({ type: 'success', title: 'Traspaso rechazado', timer: 2200 });
                    this.lsTraspasos();
                    this.lsKpis();
                    traspasosView.renderDetail(null);
                } else {
                    app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo rechazar el traspaso' });
                }
            }
        });
    }

    async cancelTraspaso(id) {
        const r = await fn_ajax({
            opc:  'rejectTraspaso',
            id:   id,
            note: 'Traspaso cancelado por el solicitante'
        }, api).catch(() => null);

        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Solicitud cancelada' });
            this.lsTraspasos();
            this.lsKpis();
            traspasosView.renderDetail(null);
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo cancelar la solicitud' });
        }
    }

    async printTraspaso(arg) {
        let t = arg;
        if (!t || typeof t !== 'object') {
            const r = await fn_ajax({ opc: 'getTraspaso', id: arg, scope_branch_id: app.branchId || '' }, api).catch(() => null);
            if (!(r && r.status === 200)) {
                if (typeof alert === 'function') alert({ icon: 'error', text: 'No se pudo cargar el traspaso para imprimir' });
                return;
            }
            t = this.mapTraspasoDetail(r.header || {}, r.detail || [], r.history || []);
        }
        this.renderTraspasoDoc(t);
    }

    renderTraspasoDoc(t) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            if (!iso) return '-';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const base = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
            if (d.getHours() === 0 && d.getMinutes() === 0) return base;
            let   h    = d.getHours();
            const min  = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${base} ${h}:${min} ${ampm}`;
        };

        const productos = t.productos || [];
        const totals = productos.reduce((acc, it) => {
            const q = Number(it.cant || 0);
            acc.uds   += q;
            acc.costo += q * Number(it.costo || 0);
            return acc;
        }, { uds: 0, costo: 0 });
        const tipos = productos.length;
        const uds   = totals.uds;
        const costo = totals.costo;

        const rowsHtml = productos.map(it => {
            const q  = Number(it.cant || 0);
            const cu = Number(it.costo || 0);
            return `
                <tr>
                    <td class="prod"><span class="prod-name">${esc(it.nombre)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td>
                    <td class="c">${esc(q)}</td>
                    <td class="r">${fmtMoney(cu)}</td>
                    <td class="r">${fmtMoney(q * cu)}</td>
                </tr>`;
        }).join('');

        const sucBlock = (label, suc) => `
            <div class="party">
                <div class="party-label">${esc(label)}</div>
                <div class="party-name">${esc((suc && suc.nombre) || '-')}</div>
                ${suc && suc.almacen ? `<div class="party-wh">${esc(suc.almacen)}</div>` : ''}
            </div>`;

        const infoItem = (k, v) => `<div class="info-item"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
        const infoHtml = [
            infoItem('Solicito',       t.solicito    || '-'),
            infoItem('Autoriza',       t.recibioUser || '-'),
            infoItem('Fecha solicitud', fmtFecha(t.fechaIso)),
            infoItem('Fecha envio',    fmtFecha(t.fechaEnvio)),
            `<div class="info-item"><span class="k">Productos</span><span class="v">${tipos} tipos &middot; ${uds} uds</span></div>`,
            infoItem('Costo total', fmtMoney(costo))
        ].join('');

        const fechaImpresion = fmtFecha(new Date().toISOString());

        const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Traspaso ${esc(t.folio || '')}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI', Arial, sans-serif; background:#c8c8c8; color:#000; padding:24px; }
.toolbar { width:816px; max-width:100%; margin:0 auto 16px; display:flex; justify-content:flex-end; gap:8px; }
.btn { cursor:pointer; border:1px solid #000; border-radius:4px; padding:8px 16px; font-size:13px; font-weight:600; color:#fff; background:#333; }
.btn:hover { opacity:.85; }
.btn.gray { background:#777; }
.sheet { width:816px; max-width:100%; min-height:1056px; margin:0 auto; background:#fff; padding:40px 48px; box-shadow:0 2px 10px rgba(0,0,0,.25); }
.doc-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:18px; }
.doc-title { font-size:22px; font-weight:800; color:#000; }
.folio { font-size:20px; font-weight:800; color:#000; }
.status { display:inline-block; margin-top:6px; font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 10px; border:1px solid #000; border-radius:3px; }
.route { display:flex; align-items:stretch; gap:12px; margin-bottom:18px; }
.party { flex:1; border:1px solid #000; border-radius:4px; padding:10px 14px; }
.party-label { font-size:10px; text-transform:uppercase; color:#555; }
.party-name { font-size:14px; font-weight:800; margin-top:2px; }
.party-wh { font-size:11px; color:#555; margin-top:1px; }
.route-arrow { display:flex; align-items:center; font-size:20px; font-weight:800; }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 40px; margin-bottom:18px; }
.info-item { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #ccc; padding-bottom:4px; font-size:12px; }
.info-item .k { color:#555; } .info-item .v { font-weight:700; text-align:right; }
table { width:100%; border-collapse:collapse; margin-bottom:18px; }
thead th { border-bottom:1.5px solid #000; font-size:10px; text-transform:uppercase; padding:4px 8px; text-align:left; }
thead th.r { text-align:right; } thead th.c { text-align:center; }
tbody td { padding:3px 8px; font-size:11px; border-bottom:1px solid #e2e2e2; }
tbody td.r { text-align:right; } tbody td.c { text-align:center; }
.prod-name { font-weight:600; } .sku { color:#777; font-size:10px; }
.totals { display:flex; justify-content:flex-end; }
.totals-box { width:280px; border:1px solid #000; border-radius:4px; padding:10px 14px; }
.totals-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; }
.totals-row.grand { border-top:1.5px solid #000; margin-top:4px; padding-top:8px; font-size:16px; font-weight:800; }
.doc-footer { margin-top:28px; display:flex; justify-content:space-between; font-size:10px; color:#777; border-top:1px solid #ccc; padding-top:10px; }
@media print { body { background:#fff; padding:0; } .toolbar { display:none; } .sheet { width:auto; min-height:auto; box-shadow:none; padding:0; } }
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
            <div class="doc-title">Comprobante de Traspaso</div>
            <div style="font-size:12px;color:#555;margin-top:3px;">Movimiento de inventario entre sucursales</div>
        </div>
        <div style="text-align:right;">
            <div class="folio">${esc(t.folio || '-')}</div>
            ${t.estado ? `<span class="status">${esc(t.estado)}</span>` : ''}
        </div>
    </div>
    <div class="route">
        ${sucBlock('Origen', t.origen)}
        <div class="route-arrow">&rarr;</div>
        ${sucBlock('Destino', t.destino)}
    </div>
    <div class="info-grid">${infoHtml}</div>
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
            <div class="totals-row"><span>Tipos de producto</span><span>${tipos}</span></div>
            <div class="totals-row"><span>Unidades</span><span>${uds}</span></div>
            <div class="totals-row grand"><span>Costo total</span><span>${fmtMoney(costo)}</span></div>
        </div>
    </div>
    ${t.nota ? `<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;color:#555;">Nota</b>${esc(t.nota)}</div>` : ''}
    <div class="doc-footer">
        <span>Huubie &middot; Inventarios &middot; Comprobante de traspaso</span>
        <span>Generado: ${esc(fechaImpresion)}</span>
    </div>
</div>
</body>
</html>`;

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


class TraspasosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME    = 'Traspasos';
        this.traspasoFormApi = null;
    }

    async ensureTraspasoForm() {
        if (this.traspasoFormApi) return this.traspasoFormApi;

        const sucursales = (app.dataInit.sucursales || []).filter(s => s.id !== '');
        const r  = await fn_ajax({ opc: 'getCatalogosTraspaso' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.traspasoFormApi = this.traspasoForm({
            parent: 'body',
            id:     'traspasoFormModal',
            json:   ok ? (r.productos || []) : [],
            data: {
                sucursales:      sucursales,
                almacenes:       ok ? (r.almacenes  || []) : [],
                categorias:      ok ? (r.categorias || []) : [],
                transformMap:    {},
                origenIdInicial: app.branchId || (sucursales[0] && sucursales[0].id) || ''
            },
            onSave:  (payload) => traspasos.nuevoTraspaso(payload),
            onClose: () => {}
        });
        return this.traspasoFormApi;
    }

    async openTraspasoForm() {
        await this.ensureTraspasoForm();
        this.traspasoFormApi.setData({ origenIdInicial: app.branchId || '' });
        this.traspasoFormApi.open();
    }

    renderDetail(traspaso) {
        this.traspasoDetailPanel({
            parent:    'detailPanel',
            json:      traspaso,
            subId:     app.branchId,
            onClose:   () => {
                app.selectedId = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            },
            onConfirm: (t) => traspasos.confirmTraspaso(t && t.id),
            onReject:  (t) => traspasos.rejectTraspaso(t && t.id),
            onCancel:  (t) => traspasos.cancelTraspaso(t && t.id),
            onPrint:   (t) => traspasos.printTraspaso(t)
        });
    }

    renderInfoCards(rows, activeId) {
        this.kpisRow({
            parent:   'kpisRow',
            json:     rows,
            cols:     6,
            activeId: activeId,
            onClick:  (kpi) => app.filterByKpi(kpi)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json:   data
        });
    }

   

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', back: null },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0'
            },
            onBack: null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    traspasoDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'traspasoDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-white flex flex-col overflow-hidden',
            json:      null,
            subId:     null,
            labels: {
                emptyTitle:       'Selecciona un traspaso',
                emptyHint:        'Haz click en una fila para ver el detalle completo aqui.',
                subtitle:         'Detalle del traspaso',
                ruta:             'Ruta del traspaso',
                origen:           'Origen',
                destino:          'Destino',
                enRuta:           'en ruta',
                solicito:         'Solicito',
                autoriza:         'Autoriza',
                recibio:          'Recibio',
                fSolicitud:       'Fecha solicitud',
                fEnvio:           'Fecha envio',
                totProd:          'Total productos',
                costoTot:         'Costo total',
                detalleProductos: 'Detalle de productos',
                producto:         'Producto',
                historial:        'Historial',
                nota:             'Nota',
                cant:             'Cant',
                costo:            'Costo',
                subtot:           'Subtotal',
                rechazar:         'Rechazar',
                cancelar:         'Cancelar Solicitud',
                aceptar:          'Aceptar Envio'
            },
            estadoPalettes: {
                'Solicitado':  { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Enviado':     { bg: 'rgba(59,130,246,0.15)',  fg: '#3B82F6' },
                'Pendiente':   { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Autorizado':  { bg: 'rgba(167,139,250,0.15)', fg: '#A78BFA' },
                'En Transito': { bg: 'rgba(251,146,60,0.15)',  fg: '#FB923C' },
                'Recibido':    { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' },
                'Entregado':   { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' },
                'Rechazado':   { bg: 'rgba(244,63,94,0.15)',   fg: '#F43F5E' }
            },
            routePalette: [
                { icon: 'text-blue-600',   bgHex: 'rgba(59,130,246,0.12)',  borderHex: 'rgba(59,130,246,0.35)' },
                { icon: 'text-green-600',  bgHex: 'rgba(63,193,137,0.12)',  borderHex: 'rgba(63,193,137,0.35)' },
                { icon: 'text-purple-600', bgHex: 'rgba(168,85,247,0.12)',  borderHex: 'rgba(168,85,247,0.35)' },
                { icon: 'text-pink-600',   bgHex: 'rgba(244,114,182,0.12)', borderHex: 'rgba(244,114,182,0.35)' },
                { icon: 'text-orange-600', bgHex: 'rgba(251,146,60,0.12)',  borderHex: 'rgba(251,146,60,0.35)' },
                { icon: 'text-cyan-600',   bgHex: 'rgba(34,211,238,0.12)',  borderHex: 'rgba(34,211,238,0.35)' }
            ],
            timelineDots: {
                'Solicitado':  'bg-blue-500',
                'Autorizado':  'bg-yellow-400',
                'En Transito': 'bg-orange-400',
                'Recibido':    'bg-green-500',
                'Rechazado':   'bg-red-500'
            },
            onClose:   () => {},
            onConfirm: () => {},
            onReject:  () => {},
            onCancel:  () => {},
            onPrint:   () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});
        opts.timelineDots   = Object.assign({}, defaults.timelineDots,   o.timelineDots   || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            if (!iso) return '-';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            let h     = d.getHours();
            const m   = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="px-3 py-3 flex-shrink-0 bg-gray-50 border-b border-gray-200">
                    <h3 class="text-sm font-bold text-gray-800">Detalle Traspaso</h3>
                    <p class="text-[10px] text-gray-500">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <i data-lucide="arrow-left-right" class="w-6 h-6 text-gray-400"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-gray-400 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>`);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const t        = opts.json;
        const items    = (t.productos || []).length;
        const uds      = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0), 0);
        const costoTot = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0) * Number(p.costo || 0), 0);
        const estadoC  = (t.estadoBg || t.estadoColor)
            ? { bg: t.estadoBg || 'rgba(156,163,175,0.18)', fg: t.estadoColor || '#9CA3AF' }
            : (opts.estadoPalettes[t.estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' });
        const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(t.estado)}</span>`;

        const palette = opts.routePalette || defaults.routePalette;
        const sucNode = (suc, label) => {
            const idNum = parseInt(suc.id, 10);
            const pal   = !isNaN(idNum) ? palette[idNum % palette.length] : palette[0];
            return `
                <div class="flex flex-col items-center text-center gap-1.5 flex-1 min-w-0">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${pal.bgHex};">
                        <i data-lucide="store" class="w-4 h-4 ${pal.icon}"></i>
                    </div>
                    <div class="min-w-0 w-full">
                        <p class="text-[8px] text-gray-500 uppercase tracking-wider leading-none">${esc(label)}</p>
                        <p class="text-[11px] font-bold text-gray-800 truncate leading-tight mt-0.5">${esc(suc.nombre)}</p>
                        ${suc.almacen ? `<p class="text-[9px] text-gray-400 truncate leading-tight">${esc(suc.almacen)}</p>` : ''}
                    </div>
                </div>`;
        };

        const productosTable = () => {
            const rows = (t.productos || []).map(p => {
                const subtotal = Number(p.cant) * Number(p.costo);
                return `
                    <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td class="py-2 px-2">
                            <p class="text-[10px] font-bold text-gray-800 leading-tight truncate">${esc(p.nombre)}</p>
                        </td>
                        <td class="py-2 px-1 text-center font-bold text-blue-600 whitespace-nowrap text-[10px]">${p.cant}</td>
                        <td class="py-2 px-1 text-right text-gray-500 whitespace-nowrap text-[10px]">${fmtMoney(p.costo)}</td>
                        <td class="py-2 px-2 text-right text-gray-800 font-bold whitespace-nowrap text-[10px]">${fmtMoney(subtotal)}</td>
                    </tr>`;
            }).join('');

            const foot = items ? `
                <tfoot>
                    <tr class="border-t border-gray-200">
                        <td class="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Total</td>
                        <td class="py-2.5 px-1 text-center font-bold text-blue-600 whitespace-nowrap">${uds}</td>
                        <td class="py-2.5 px-1"></td>
                        <td class="py-2.5 px-2 text-right text-sm font-bold text-green-600 whitespace-nowrap">${fmtMoney(costoTot)}</td>
                    </tr>
                </tfoot>` : '';

            return `
                <div class="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${esc(opts.labels.detalleProductos)}</p>
                        <p class="text-[10px] text-gray-400">${items} productos &middot; ${uds} uds</p>
                    </div>
                    <table class="w-full text-[11px] border-collapse table-fixed">
                        <thead>
                            <tr class="text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                <th class="py-2 px-2 text-left font-bold">${esc(opts.labels.producto)}</th>
                                <th class="py-2 px-1 text-center font-bold w-10">${esc(opts.labels.cant)}</th>
                                <th class="py-2 px-1 text-right font-bold w-16">${esc(opts.labels.costo)}</th>
                                <th class="py-2 px-2 text-right font-bold w-20">${esc(opts.labels.subtot)}</th>
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="4" class="py-2 text-center text-[11px] text-gray-400 italic">Sin productos</td></tr>`}</tbody>
                        ${foot}
                    </table>
                </div>`;
        };

        const timelineHtml = (t.timeline || []).map((tl, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const dot = opts.timelineDots[tl.estado] || 'bg-gray-400';
            return `
                <div class="relative ${isLast ? '' : 'pb-3'}">
                    <div class="absolute -left-[17px] top-0 w-2.5 h-2.5 rounded-full ${dot} border-2 border-white"></div>
                    <p class="text-[10px] font-medium text-gray-700">${esc(tl.estado)} <span class="text-gray-400">${esc(tl.usuario || '')}</span></p>
                    <p class="text-[9px] text-gray-400">${esc(fmtFecha(tl.fechaIso))}</p>
                </div>`;
        }).join('') || '<p class="text-[10px] text-gray-400 italic">Sin historial</p>';

        const subId     = opts.subId != null ? String(opts.subId) : '';
        const origenId  = (t.origen  && t.origen.id  != null) ? String(t.origen.id)  : '';
        const destinoId = (t.destino && t.destino.id != null) ? String(t.destino.id) : '';
        const isOrigin  = subId !== '' && subId === origenId;
        const isDestino = subId !== '' && subId === destinoId;

        const code        = t.statusCode || '';
        const isRequested = code === 'REQUESTED';
        const isLegacyMid = code === 'AUTHORIZED' || code === 'IN_TRANSIT';
        const canAccept   = isDestino && (isRequested || isLegacyMid);

        const btnCancel = `
            <button type="button" id="${opts.id}_cancel"
                    class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all">
                <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>${esc(opts.labels.cancelar)}
            </button>`;
        const btnReject = `
            <button type="button" id="${opts.id}_reject"
                    class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all">
                <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>${esc(opts.labels.rechazar)}
            </button>`;
        const btnAccept = `
            <button type="button" id="${opts.id}_accept"
                    class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.aceptar)}
            </button>`;

        let actionsHtml = '';
        let mode        = '';
        if (isRequested && isOrigin) { actionsHtml = btnCancel;             mode = 'cancel'; }
        else if (canAccept)          { actionsHtml = btnReject + btnAccept; mode = 'accept'; }

        aside.html(`
            <div class="px-3 py-3 flex-shrink-0 flex items-center justify-between bg-gray-50 border-b border-gray-200">
                <div>
                    <h3 class="text-sm font-bold text-gray-800">Traspaso ${esc(t.folio)}</h3>
                    <p class="text-[10px] text-gray-500">${esc(fmtFecha(t.fechaIso))}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${estadoBadge}
                    <button id="${opts.id}_print" class="text-gray-500 hover:text-gray-700 transition-colors p-1" title="Imprimir traspaso">
                        <i data-lucide="printer" class="w-4 h-4"></i>
                    </button>
                    <button id="${opts.id}_close" class="text-gray-500 hover:text-gray-700 transition-colors p-1" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-3">

                <div class="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                    <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">${esc(opts.labels.ruta)}</p>
                    <div class="flex items-start gap-2">
                        ${sucNode(t.origen, opts.labels.origen)}
                        <div class="flex flex-col items-center gap-0.5 flex-shrink-0 pt-2">
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-blue-600"></i>
                            <span class="text-[8px] text-gray-400">${esc(opts.labels.enRuta)}</span>
                        </div>
                        ${sucNode(t.destino, opts.labels.destino)}
                    </div>
                </div>

                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5">
                    <div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.solicito)}</span><span class="font-medium text-gray-700">${esc(t.solicito || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.autoriza)}</span><span class="font-medium text-gray-700">${esc(t.recibioUser || '-')}</span></div>
                    ${t.recibio ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.recibio)}</span><span class="font-medium text-gray-700">${esc(t.recibio)}</span></div>` : ''}
                    <div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.fSolicitud)}</span><span class="text-gray-700">${esc(fmtFecha(t.fechaIso))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.fEnvio)}</span><span class="text-gray-700">${esc(fmtFecha(t.fechaEnvio))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.totProd)}</span><span class="font-bold text-gray-800">${items} tipos / ${uds} uds</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.costoTot)}</span><span class="font-bold text-green-600">${fmtMoney(costoTot)}</span></div>
                </div>

                ${productosTable()}

                <div>
                    <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">${esc(opts.labels.historial)}</p>
                    <div class="space-y-0 border-l-2 border-gray-200 ml-2 pl-3">
                        ${timelineHtml}
                    </div>
                </div>

                ${t.nota ? `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">${esc(opts.labels.nota)}</p>
                    <p class="text-[11px] text-gray-600">${esc(t.nota)}</p>
                </div>` : ''}
            </div>

            ${actionsHtml ? `<div class="px-3 py-3 flex gap-2 flex-shrink-0">${actionsHtml}</div>` : ''}
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(t));
        $(`#${opts.id}_print`).on('click', () => opts.onPrint(t));
        if (mode === 'cancel') {
            $(`#${opts.id}_cancel`).on('click', () => opts.onCancel(t));
        } else if (mode === 'accept') {
            $(`#${opts.id}_reject`).on('click', () => opts.onReject(t));
            $(`#${opts.id}_accept`).on('click', () => opts.onConfirm(t));
        }
    }
}
