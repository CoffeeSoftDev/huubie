// -- Traspasos --
// La pantalla de inventory/operacion/almacen/traspasos aplicada al Catálogo de
// pro: visor con KPIs por estado (clic = filtra), tabla y el detalle con la ruta
// a la derecha. La captura es traspaso-form.js (la de inventory). Enviar no
// mueve nada; el destino lo acepta (resta allá y suma aquí) o lo rechaza.
// Comunes (can, invEsc, viewHeader...) en inventarios.js.

let apiTraspasos = 'ctrl/ctrl-traspasos.php';
let app, traspasos, traspasosView;

const VIEW_HEADER_TRASPASOS = {
    title:    'Visor de Traspasos',
    subtitle: 'Gestión de movimientos entre sucursales'
};

$(async () => {
    traspasosView = new TraspasosView(apiTraspasos, 'root');
    traspasos     = new Traspasos(apiTraspasos, 'root');
    app           = new App(apiTraspasos, 'root');
    await app.init();
});

// La captura de inventory con el origen fijo en la sucursal de arriba.
class InvTraspasoForm extends TraspasoForm {

    open() {
        super.open();
        $(`#${this.opts.id}_origenSuc`).val(String(app.branchId)).prop('disabled', true);
        this.onChangeSucursal();
    }
}

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Traspasos';
        this.branchId     = null;
        this.selectedId   = null;
        this.dataInit     = {};
    }

    async init() {
        const r = await useFetch({ url: apiTraspasos, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch_id:  r.branch_id || '',
            branch:     (r.scope || {}).branch || '',
            sucursales: r.sucursales || [],
            costs:      !!r.costs
        };
        this.branchId = this.dataInit.branch_id;

        this.render();
    }

    render() {
        this.invVisorLayout({ id: this.PROJECT_NAME, key: 'traspasos' });
        this.visorResize({ key: 'traspasos', label: 'Ancho del detalle del traspaso' });
        this.filterBar();
        traspasosView.renderHeader(Object.assign({}, VIEW_HEADER_TRASPASOS, {
            titleHtml: invTitleHtml(VIEW_HEADER_TRASPASOS.title, this.dataInit.branch)
        }));
        traspasosView.renderDetail(null);
        traspasos.lsTraspasos();
        traspasos.lsKpis();
    }

    filterBar() {
        // Estados relativos a mi sucursal (lo que envío vs lo que recibo).
        const estados = [
            { id: '',            valor: 'Todos los estados' },
            { id: 'enviados',    valor: 'Enviados' },
            { id: 'por_recibir', valor: 'Por recibir' },
            { id: 'entregados',  valor: 'Entregados' },
            { id: 'recibidos',   valor: 'Recibidos' },
            { id: 'rechazados',  valor: 'Rechazados' }
        ];

        const filters = [
            { opc: 'input-calendar', id: `calendar${this.PROJECT_NAME}`, lbl: 'Rango de fecha:', class: 'col-12 col-md-3 col-lg-3', readonly: true, required: false },
            {
                opc:      'select',
                id:       'fDestino',
                lbl:      'Destino:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: 'Todas las sucursales' }].concat(this.dataInit.sucursales || [])
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     estados
            }
        ];

        if (can('agregar')) {
            filters.push({
                opc:       'button',
                id:        'btnNuevoTraspaso',
                text:      'Nuevo Traspaso',
                color_btn: 'primary',
                class:     'col-12 col-md-3 col-lg-3',
                onClick:   () => traspasosView.openTraspasoForm()
            });
        }

        this.createfilterBar({ parent: 'filterBar', coffeesoft: true, theme: 'light', data: filters });

        const range = this.invRangePicker({
            parent:   `calendar${this.PROJECT_NAME}`,
            start:    moment().startOf('month'),
            end:      moment(),
            onSelect: (fi, ff) => {
                this.rangeFi = fi;
                this.rangeFf = ff;
                this.onChangeFilters();
            }
        });

        this.rangeFi = range.fi;
        this.rangeFf = range.ff;
    }

    getFilters() {
        return {
            relative: $('#fEstado').val() || '',
            destino:  $('#fDestino').val() || '',
            fi:       this.rangeFi || '',
            ff:       this.rangeFf || ''
        };
    }

    async onChangeFilters() {
        traspasos.lsTraspasos();
        await traspasos.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) this.selectTraspaso(null);
    }

    // Clic en una tarjeta = filtra por ese estado; otro clic lo quita.
    filterByKpi(kpi) {
        const rel     = (kpi && kpi.rel) || '';
        const current = $('#fEstado').val() || '';

        $('#fEstado').val(current === rel ? '' : rel);
        this.onChangeFilters();
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    selectTraspaso(folio, id) {
        this.selectedId = folio;
        invMarkRow(`tb${this.PROJECT_NAME}`, folio);

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

    // Columnas: Folio, Origen, Destino, Productos, Unidades [, Costo], Solicitó, Recibió, Estado, Solicitud
    async lsTraspasos() {
        const f     = app.getFilters();
        const costs = app.dataInit.costs;
        const r     = await useFetch({
            url:  apiTraspasos,
            data: { opc: 'lsTraspasos', relative: f.relative, destination_branch_id: f.destino, fi: f.fi, ff: f.ff }
        });
        const data  = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       costs ? [4, 5, 9, 10] : [4, 5, 8, 9],
            right:        costs ? [6] : [],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron traspasos con los filtros aplicados',
            emptyIcon:    'icon-arrow-left-right',
            data
        });

        if (window.lucide) lucide.createIcons();

        if ((data.row || []).length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 15);
        }

        if (app.selectedId) invMarkRow(`tb${this.PROJECT_NAME}`, app.selectedId);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({ url: apiTraspasos, data: { opc: 'showTraspasos', fi: f.fi, ff: f.ff } });
        const c = (r && r.status === 200) ? r.counts : {};

        const value = (n) => {
            const v = parseInt(n || 0, 10);
            return v === 0 ? '-' : v;
        };

        const kpis = [
            { id: 'kpiTotal',      label: 'Total',       value: value(c.total),       tone: 'default', rel: '' },
            { id: 'kpiEnviados',   label: 'Enviados',    value: value(c.enviados),    tone: 'warning', rel: 'enviados' },
            { id: 'kpiPorRecibir', label: 'Por recibir', value: value(c.por_recibir), tone: 'info',    rel: 'por_recibir' },
            { id: 'kpiEntregados', label: 'Entregados',  value: value(c.entregados),  tone: 'success', rel: 'entregados' },
            { id: 'kpiRecibidos',  label: 'Recibidos',   value: value(c.recibidos),   tone: 'success', rel: 'recibidos' },
            { id: 'kpiRechazados', label: 'Rechazados',  value: value(c.rechazados),  tone: 'danger',  rel: 'rechazados' }
        ];

        const current = $('#fEstado').val() || '';
        const match   = kpis.find((k) => (k.rel || '') === current);

        traspasosView.renderInfoCards(kpis, match ? match.id : '');
    }

    async getTraspaso(id) {
        const r = await useFetch({ url: apiTraspasos, data: { opc: 'getTraspaso', id } });

        if (r && r.status === 200) {
            traspasosView.renderDetail(this.mapTraspasoDetail(r.header || {}, r.detail || [], r.history || []));
        } else {
            traspasosView.renderDetail(null);
            if (r && r.message) this.alertBox({ type: 'error', title: r.message });
        }
    }

    mapTraspasoDetail(h, detail, history) {
        const toIso = (s) => s ? String(s).replace(' ', 'T') : '';

        return {
            id:          h.id,
            folio:       h.folio,
            estado:      h.relative_status_name || '',
            statusCode:  h.status_code || '',
            estadoColor: h.status_color || '',
            fechaIso:    toIso(h.date_request),
            fechaRecibo: toIso(h.date_received),
            solicito:    h.requested_user_name || '',
            recibio:     h.received_by_name || '',
            recibioUser: h.received_user_name || '',
            rechazo:     h.reject_reason || '',
            nota:        h.note || '',
            canAccept:   !!h.can_accept,
            canCancel:   !!h.can_cancel,
            origen:  { id: String(h.origin_branch_id || ''),      nombre: h.origin_branch_name || '-',      almacen: h.origin_warehouse_name || '' },
            destino: { id: String(h.destination_branch_id || ''), nombre: h.destination_branch_name || '-', almacen: h.destination_warehouse_name || '' },
            productos: (detail || []).map((d) => ({
                nombre: d.item_name || '',
                sku:    d.sku || '',
                unidad: d.unit || '',
                cant:   Number(d.quantity || 0),
                costo:  Number(d.cost || 0)
            })),
            timeline: (history || []).map((x) => ({
                estado:   x.status_name || '',
                usuario:  x.user_name || '',
                nota:     x.note || '',
                fechaIso: toIso(x.transitioned_at)
            }))
        };
    }

    async nuevoTraspaso(payload) {
        const origen  = payload.origen  || {};
        const destino = payload.destino || {};
        const backend = {
            note:                     payload.nota || null,
            origin_branch_id:         origen.id,
            destination_branch_id:    destino.id,
            origin_warehouse_id:      (origen.almacen  || {}).id,
            destination_warehouse_id: (destino.almacen || {}).id,
            productos: (payload.productos || []).map((p) => ({ item_id: p.productId, quantity: p.cant }))
        };

        const r = await useFetch({ url: apiTraspasos, data: { opc: 'saveTraspaso', payload: JSON.stringify(backend) } });

        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message || ('Traspaso ' + r.folio + ' solicitado'), timer: 2200 });
            await this.lsTraspasos();
            this.lsKpis();
            if (r.folio && r.id) app.selectTraspaso(r.folio, r.id);
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo crear el traspaso' });
        }
    }

    // Aceptar = recibir todo: pide quién lo recibe.
    confirmTraspaso(t) {
        this.alertBox({
            type:             'confirm',
            icon:             'check-circle',
            iconBg:           'bg-green-50',
            iconColor:        'text-green-600',
            title:            'Aceptar envío',
            detailHtml:       `Se resta de ${invEsc(t.origen.almacen || t.origen.nombre)} y se suma a ${invEsc(t.destino.almacen || t.destino.nombre)}.`,
            input:            'text',
            inputLabel:       '¿Quién recibe el traspaso?',
            inputPlaceholder: 'Nombre de quien recibe',
            inputRequired:    true,
            inputError:       'Indica quién recibe el traspaso',
            okLabel:          'Aceptar y recibir',
            okBg:             'bg-green-600 hover:bg-green-500',
            cancelLabel:      'Cancelar',
            onOk: async (receivedBy) => {
                const r = await useFetch({ url: apiTraspasos, data: { opc: 'confirmTraspaso', id: t.id, received_by: receivedBy } }).catch(() => null);

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Traspaso recibido', timer: 2200 });
                    this.lsTraspasos();
                    this.lsKpis();
                    this.getTraspaso(t.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo confirmar' });
                }
            }
        });
    }

    rejectTraspaso(t) {
        this.alertBox({
            type:             'cancel',
            title:            '¿Rechazar envío?',
            detailHtml:       'El traspaso se marcará como rechazado. No se mueve nada del inventario.',
            input:            'textarea',
            inputLabel:       'Motivo del rechazo (opcional)',
            inputPlaceholder: 'Indica por qué se rechaza el traspaso',
            okLabel:          'Sí, rechazar',
            cancelLabel:      'No',
            onOk: async (reason) => {
                const r = await useFetch({ url: apiTraspasos, data: { opc: 'rejectTraspaso', id: t.id, note: reason || '' } }).catch(() => null);

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Traspaso rechazado', timer: 2200 });
                    this.lsTraspasos();
                    this.lsKpis();
                    this.getTraspaso(t.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo rechazar el traspaso' });
                }
            }
        });
    }

    cancelTraspaso(t) {
        this.alertBox({
            type:        'cancel',
            title:       '¿Cancelar la solicitud?',
            detailHtml:  'Nadie lo ha recibido: no se mueve nada del inventario.',
            okLabel:     'Sí, cancelar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiTraspasos, data: { opc: 'cancelTraspaso', id: t.id } }).catch(() => null);

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Solicitud cancelada', timer: 2200 });
                    this.lsTraspasos();
                    this.lsKpis();
                    this.getTraspaso(t.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar la solicitud' });
                }
            }
        });
    }

    async printTraspaso(arg) {
        let t = arg;

        if (!t || typeof t !== 'object') {
            const r = await useFetch({ url: apiTraspasos, data: { opc: 'getTraspaso', id: arg } });

            if (!(r && r.status === 200)) {
                this.alertBox({ type: 'error', title: 'No se pudo cargar el traspaso para imprimir' });
                return;
            }

            t = this.mapTraspasoDetail(r.header || {}, r.detail || [], r.history || []);
        }

        this.renderTraspasoDoc(t);
    }

    // El comprobante con la ruta origen → destino (el de inventory).
    renderTraspasoDoc(t) {
        const esc      = invEsc;
        const costs    = app.dataInit.costs;
        const fmtMoney = invMoney;
        const DOW      = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const MON      = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fmtFecha = (iso) => {
            if (!iso) return '-';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const base = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
            if (d.getHours() === 0 && d.getMinutes() === 0) return base;
            let hh = d.getHours();
            const min = String(d.getMinutes()).padStart(2, '0');
            const ampm = hh >= 12 ? 'pm' : 'am';
            hh = hh % 12 || 12;
            return `${base} ${hh}:${min} ${ampm}`;
        };

        const productos = t.productos || [];
        const uds       = productos.reduce((s, it) => s + Number(it.cant || 0), 0);
        const costo     = productos.reduce((s, it) => s + Number(it.cant || 0) * Number(it.costo || 0), 0);
        const rowsHtml  = productos.map((it) => `
            <tr>
                <td class="prod"><span class="prod-name">${esc(it.nombre)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td>
                <td class="c">${esc(invQty(it.cant))} ${esc(it.unidad)}</td>
                ${costs ? `<td class="r">${fmtMoney(it.costo)}</td><td class="r">${fmtMoney(Number(it.cant) * Number(it.costo))}</td>` : ''}
            </tr>`).join('');

        const party = (label, suc) => `
            <div class="party">
                <div class="party-label">${esc(label)}</div>
                <div class="party-name">${esc((suc && suc.nombre) || '-')}</div>
                ${suc && suc.almacen ? `<div class="party-wh">${esc(suc.almacen)}</div>` : ''}
            </div>`;
        const item = (k, v) => `<div class="info-item"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Traspaso ${esc(t.folio || '')}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI', Arial, sans-serif; background:#c8c8c8; color:#000; padding:24px; }
.toolbar { width:816px; max-width:100%; margin:0 auto 16px; display:flex; justify-content:flex-end; gap:8px; }
.btn { cursor:pointer; border:1px solid #000; border-radius:4px; padding:8px 16px; font-size:13px; font-weight:600; color:#fff; background:#333; }
.btn.gray { background:#777; }
.sheet { width:816px; max-width:100%; min-height:1056px; margin:0 auto; background:#fff; padding:40px 48px; box-shadow:0 2px 10px rgba(0,0,0,.25); }
.doc-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:18px; }
.doc-title { font-size:22px; font-weight:800; }
.folio { font-size:20px; font-weight:800; }
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
</style></head><body>
<div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
<div class="sheet">
    <div class="doc-header">
        <div><div class="doc-title">Comprobante de Traspaso</div><div style="font-size:12px;color:#555;margin-top:3px;">Movimiento de inventario entre sucursales</div></div>
        <div style="text-align:right;"><div class="folio">${esc(t.folio || '-')}</div>${t.estado ? `<span class="status">${esc(t.estado)}</span>` : ''}</div>
    </div>
    <div class="route">${party('Origen', t.origen)}<div class="route-arrow">&rarr;</div>${party('Destino', t.destino)}</div>
    <div class="info-grid">
        ${item('Solicitó', t.solicito || '-')}
        ${item('Recibe', t.recibio || '-')}
        ${item('Fecha solicitud', fmtFecha(t.fechaIso))}
        ${item('Fecha recepción', fmtFecha(t.fechaRecibo))}
        <div class="info-item"><span class="k">Productos</span><span class="v">${productos.length} tipos &middot; ${esc(invQty(uds))} uds</span></div>
        ${costs ? item('Costo total', fmtMoney(costo)) : ''}
    </div>
    <table>
        <thead><tr><th>Producto</th><th class="c">Cant</th>${costs ? '<th class="r">Costo unit.</th><th class="r">Subtotal</th>' : ''}</tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="${costs ? 4 : 2}" class="c">Sin productos</td></tr>`}</tbody>
    </table>
    <div class="totals"><div class="totals-box">
        <div class="totals-row"><span>Tipos de producto</span><span>${productos.length}</span></div>
        <div class="totals-row${costs ? '' : ' grand'}"><span>Unidades</span><span>${esc(invQty(uds))}</span></div>
        ${costs ? `<div class="totals-row grand"><span>Costo total</span><span>${fmtMoney(costo)}</span></div>` : ''}
    </div></div>
    ${t.nota ? `<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;color:#555;">Nota</b>${esc(t.nota)}</div>` : ''}
    <div class="doc-footer"><span>Huubie &middot; Inventarios &middot; Comprobante de traspaso</span><span>Generado: ${esc(fmtFecha(new Date().toISOString()))}</span></div>
</div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');

        if (!w) {
            this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' });
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

    // Se arma al abrirla la primera vez: lo que hay en cada sucursal cambia todo el día.
    async openTraspasoForm() {
        const r = await useFetch({ url: apiTraspasos, data: { opc: 'getCatalogosTraspaso' } });

        if (!(r && r.status === 200)) return this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo abrir la captura' });

        if (this.traspasoFormApi) {
            this.traspasoFormApi.wrap.remove();
            this.traspasoFormApi = null;
        }

        this.traspasoFormApi = new InvTraspasoForm({
            parent: 'body',
            id:     'traspasoFormModal',
            json:   r.productos || [],
            labels: { subtitle: 'Productos del Catálogo de una sucursal a otra' },
            data: {
                sucursales:      r.sucursales || [],
                almacenes:       r.almacenes  || [],
                categorias:      r.categorias || [],
                origenIdInicial: app.branchId
            },
            onSave:  (payload) => traspasos.nuevoTraspaso(payload),
            onClose: () => {}
        });

        this.traspasoFormApi.open();
    }

    renderDetail(traspaso) {
        this.traspasoDetailPanel({
            parent: 'detailPanel',
            json:   traspaso,
            costs:  app.dataInit.costs,
            print:  can('imprimir'),
            onClose: () => {
                app.selectedId = null;
                this.renderDetail(null);
                invMarkRow(`tb${this.PROJECT_NAME}`, null);
            },
            onConfirm: (t) => traspasos.confirmTraspaso(t),
            onReject:  (t) => traspasos.rejectTraspaso(t),
            onCancel:  (t) => traspasos.cancelTraspaso(t),
            onPrint:   (t) => traspasos.printTraspaso(t)
        });

        invToggleVisor(!!traspaso);
    }

    renderInfoCards(rows, activeId) {
        this.kpisRow({ parent: 'kpisRow', json: rows, cols: 6, activeId, onClick: (kpi) => app.filterByKpi(kpi) });
    }

    renderHeader(data) {
        this.viewHeader({ parent: 'viewHeader', json: data });
    }

    // -- Visor de la derecha (el de inventory): ruta, datos, productos, historial --

    traspasoDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'traspasoDetailPanel',
            class:  'w-full h-full flex-shrink-0 bg-white flex flex-col overflow-hidden',
            json:   null,
            costs:  true,
            print:  true,
            labels: {
                emptyTitle:       'Selecciona un traspaso',
                emptyHint:        'Haz click en el folio o en el ojo para ver el detalle completo aquí.',
                subtitle:         'Detalle del traspaso',
                ruta:             'Ruta del traspaso',
                origen:           'Origen',
                destino:          'Destino',
                enRuta:           'en ruta',
                solicito:         'Solicitó',
                autoriza:         'Aceptó',
                recibio:          'Recibió',
                fSolicitud:       'Fecha solicitud',
                fRecibo:          'Fecha recepción',
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
                aceptar:          'Aceptar Envío'
            },
            routePalette: [
                { icon: 'text-blue-600',   bgHex: 'rgb(var(--brand-600, 192 90 64) /0.12)' },
                { icon: 'text-green-600',  bgHex: 'rgba(63,193,137,0.12)' },
                { icon: 'text-purple-600', bgHex: 'rgba(168,85,247,0.12)' },
                { icon: 'text-pink-600',   bgHex: 'rgba(244,114,182,0.12)' },
                { icon: 'text-orange-600', bgHex: 'rgba(251,146,60,0.12)' },
                { icon: 'text-cyan-600',   bgHex: 'rgba(34,211,238,0.12)' }
            ],
            timelineDots: {
                'Enviado':     'bg-amber-500',
                'Por recibir': 'bg-amber-500',
                'Solicitado':  'bg-amber-500',
                'Entregado':   'bg-green-500',
                'Recibido':    'bg-green-500',
                'Rechazado':   'bg-red-500',
                'Cancelado':   'bg-gray-400'
            },
            onClose:   () => {},
            onConfirm: () => {},
            onReject:  () => {},
            onCancel:  () => {},
            onPrint:   () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels       = Object.assign({}, defaults.labels,       o.labels       || {});
        opts.timelineDots = Object.assign({}, defaults.timelineDots, o.timelineDots || {});

        const esc      = invEsc;
        const fmtMoney = invMoney;
        const costs    = !!opts.costs;
        const DOW      = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const MON      = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fmtFecha = (iso) => {
            if (!iso) return '-';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            let hh = d.getHours();
            const m = String(d.getMinutes()).padStart(2, '0');
            const ampm = hh >= 12 ? 'pm' : 'am';
            hh = hh % 12 || 12;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${String(hh).padStart(2, '0')}:${m} ${ampm}`;
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
        const hex      = /^#[0-9A-Fa-f]{6}$/.test(String(t.estadoColor || '')) ? t.estadoColor : '#9CA3AF';
        const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${hex}26;color:${hex};">${esc(t.estado)}</span>`;
        const palette  = opts.routePalette;

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
            const rows = (t.productos || []).map((p) => `
                <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td class="py-2 px-2"><p class="text-[10px] font-bold text-gray-800 leading-tight truncate">${esc(p.nombre)}</p></td>
                    <td class="py-2 px-1 text-center font-bold text-blue-600 whitespace-nowrap text-[10px]">${esc(invQty(p.cant))} <span class="font-normal text-gray-400">${esc(p.unidad)}</span></td>
                    ${costs ? `<td class="py-2 px-1 text-right text-gray-500 whitespace-nowrap text-[10px]">${fmtMoney(p.costo)}</td>
                    <td class="py-2 px-2 text-right text-gray-800 font-bold whitespace-nowrap text-[10px]">${fmtMoney(Number(p.cant) * Number(p.costo))}</td>` : ''}
                </tr>`).join('');

            const foot = items ? `
                <tfoot>
                    <tr class="border-t border-gray-200">
                        <td class="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Total</td>
                        <td class="py-2.5 px-1 text-center font-bold text-blue-600 whitespace-nowrap">${esc(invQty(uds))}</td>
                        ${costs ? `<td class="py-2.5 px-1"></td><td class="py-2.5 px-2 text-right text-sm font-bold text-green-600 whitespace-nowrap">${fmtMoney(costoTot)}</td>` : ''}
                    </tr>
                </tfoot>` : '';

            return `
                <div class="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${esc(opts.labels.detalleProductos)}</p>
                        <p class="text-[10px] text-gray-400">${items} productos &middot; ${esc(invQty(uds))} uds</p>
                    </div>
                    <table class="w-full text-[11px] border-collapse table-fixed">
                        <thead>
                            <tr class="text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                <th class="py-2 px-2 text-left font-bold">${esc(opts.labels.producto)}</th>
                                <th class="py-2 px-1 text-center font-bold w-20">${esc(opts.labels.cant)}</th>
                                ${costs ? `<th class="py-2 px-1 text-right font-bold w-16">${esc(opts.labels.costo)}</th><th class="py-2 px-2 text-right font-bold w-20">${esc(opts.labels.subtot)}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="${costs ? 4 : 2}" class="py-2 text-center text-[11px] text-gray-400 italic">Sin productos</td></tr>`}</tbody>
                        ${foot}
                    </table>
                </div>`;
        };

        const timelineHtml = (t.timeline || []).map((tl, idx, arr) => `
            <div class="relative ${idx === arr.length - 1 ? '' : 'pb-3'}">
                <div class="absolute -left-[17px] top-0 w-2.5 h-2.5 rounded-full ${opts.timelineDots[tl.estado] || 'bg-gray-400'} border-2 border-white"></div>
                <p class="text-[10px] font-medium text-gray-700">${esc(tl.estado)} <span class="text-gray-400">${esc(tl.usuario || '')}</span></p>
                <p class="text-[9px] text-gray-400">${esc(fmtFecha(tl.fechaIso))}</p>
                ${tl.nota ? `<p class="text-[10px] text-gray-500">${esc(tl.nota)}</p>` : ''}
            </div>`).join('') || '<p class="text-[10px] text-gray-400 italic">Sin historial</p>';

        const btn = (id, color, icon, label) => `
            <button type="button" id="${opts.id}_${id}" class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 ${color} hover:shadow-lg transition-all">
                <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>${esc(label)}
            </button>`;

        let actionsHtml = '';
        if (t.canCancel)      actionsHtml = btn('cancel', 'bg-red-600 hover:bg-red-500', 'x-circle', opts.labels.cancelar);
        else if (t.canAccept) actionsHtml = btn('reject', 'bg-red-600 hover:bg-red-500', 'x-circle', opts.labels.rechazar) + btn('accept', 'bg-green-600 hover:bg-green-500', 'check-circle-2', opts.labels.aceptar);

        const line = (label, value, cls = 'text-gray-700') => `<div class="flex justify-between gap-2 text-[11px]"><span class="text-gray-500">${esc(label)}</span><span class="${cls} text-right">${value}</span></div>`;

        aside.html(`
            <div class="px-3 py-3 flex-shrink-0 flex items-center justify-between bg-gray-50 border-b border-gray-200">
                <div>
                    <h3 class="text-sm font-bold text-gray-800">Traspaso ${esc(t.folio)}</h3>
                    <p class="text-[10px] text-gray-500">${esc(fmtFecha(t.fechaIso))}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${estadoBadge}
                    ${opts.print ? `<button id="${opts.id}_print" class="text-gray-500 hover:text-gray-700 transition-colors p-1" title="Imprimir traspaso"><i data-lucide="printer" class="w-4 h-4"></i></button>` : ''}
                    <button id="${opts.id}_close" class="text-gray-500 hover:text-gray-700 transition-colors p-1" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
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
                    ${line(opts.labels.solicito, esc(t.solicito || '-'), 'font-medium text-gray-700')}
                    ${line(opts.labels.autoriza, esc(t.recibioUser || '-'), 'font-medium text-gray-700')}
                    ${t.recibio ? line(opts.labels.recibio, esc(t.recibio), 'font-medium text-gray-700') : ''}
                    ${line(opts.labels.fSolicitud, esc(fmtFecha(t.fechaIso)))}
                    ${line(opts.labels.fRecibo, esc(fmtFecha(t.fechaRecibo)))}
                    ${line(opts.labels.totProd, `${items} tipos / ${esc(invQty(uds))} uds`, 'font-bold text-gray-800')}
                    ${costs ? line(opts.labels.costoTot, fmtMoney(costoTot), 'font-bold text-green-600') : ''}
                    ${t.rechazo ? line('Motivo', esc(t.rechazo)) : ''}
                </div>

                ${productosTable()}

                <div>
                    <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">${esc(opts.labels.historial)}</p>
                    <div class="space-y-0 border-l-2 border-gray-200 ml-2 pl-3">${timelineHtml}</div>
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

        $(`#${opts.id}_close`).on('click',  () => opts.onClose(t));
        $(`#${opts.id}_print`).on('click',  () => opts.onPrint(t));
        $(`#${opts.id}_cancel`).on('click', () => opts.onCancel(t));
        $(`#${opts.id}_reject`).on('click', () => opts.onReject(t));
        $(`#${opts.id}_accept`).on('click', () => opts.onConfirm(t));
    }
}
