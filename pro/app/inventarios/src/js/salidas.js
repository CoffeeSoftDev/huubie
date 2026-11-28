// -- Salidas --
// La pantalla de inventory/operacion/almacen/salidas aplicada al Catálogo de
// pro: visor con filtros, tarjetas KPI, tabla y el detalle a la derecha. La
// captura es salida-form.js (la de inventory). Consumo, degustación y mermas;
// no se saca más de lo que hay y la merma pide foto.
// Comunes (can, invEsc, viewHeader, kpisRow...) en inventarios.js.

let apiSalidas = 'ctrl/ctrl-salidas.php';
let app, salidas, salidasView;

const VIEW_HEADER_SALIDAS = {
    title:    'Salidas de Inventario',
    subtitle: 'Control de salidas por sucursal, motivo y periodo'
};

$(async () => {
    salidasView = new SalidasView(apiSalidas, 'root');
    salidas     = new Salidas(apiSalidas, 'root');
    app         = new App(apiSalidas, 'root');
    await app.init();
});

// La captura de inventory con lo que pro revisa antes de cerrarla: si el
// servidor la rechazara, se perdería lo capturado.
class InvSalidaForm extends SalidaForm {

    doRegistrar() {
        const o      = this.opts;
        const motivo = (o.data.motivos || []).find((m) => String(m.id) === String($(`#${o.id}_selMotivo`).val())) || {};

        // Editando, la merma que ya tiene foto la conserva.
        if (this.lote.length && Number(motivo.requires_evidence) && !this.photo && !(this.editing && this.editing.evidence)) {
            this.notify(`«${motivo.valor}» pide una foto de evidencia: usa el botón Evidencia.`);
            return;
        }

        const frac = this.lote.find((p) => !Number(p.decimals) && Math.floor(Number(p.cantidad)) !== Number(p.cantidad));
        if (frac) {
            this.notify(`«${frac.nombre}» se cuenta en ${frac.unidad || 'piezas'}: sin decimales.`);
            return;
        }

        const corto = this.lote.find((p, i) => Number(p.stock || 0) - this.usadoAntes(p.id, i) - Number(p.cantidad || 0) < -0.00001);
        if (corto) {
            this.notify(`No hay suficiente «${corto.nombre}» en el almacén.`);
            return;
        }

        super.doRegistrar();
    }

    openEdit(salida) {
        super.openEdit(salida);
        if (this.editing) this.editing.evidence = !!salida.evidence;
    }
}

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'salidas';
        this.subId        = null;
        this.selectedId   = null;
        this.rangeFi      = '';
        this.rangeFf      = '';
    }

    async init() {
        const r = await useFetch({ url: apiSalidas, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch_id:  r.branch_id || '',
            branch:     (r.scope || {}).branch || '',
            sucursales: r.sucursales     || [],
            motivos:    r.motivos_salida || [],
            almacenes:  r.almacenes      || [],
            productos:  r.productos      || [],
            costs:      !!r.costs
        };
        this.subId = this.dataInit.branch_id;

        this.render();
    }

    render() {
        this.invVisorLayout({ id: this.PROJECT_NAME, key: 'salidas' });
        this.visorResize({ key: 'salidas', label: 'Ancho del detalle de la salida' });
        this.filterBar();
        salidasView.renderDetail(null);
        this.populateFilters();
        salidasView.renderHeader(Object.assign({}, VIEW_HEADER_SALIDAS, {
            titleHtml: invTitleHtml(VIEW_HEADER_SALIDAS.title, this.dataInit.branch)
        }));
        salidas.lsSalidas();
        salidas.lsKpis();
    }

    filterBar() {
        const filters = [
            {
                opc:         'input-calendar',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-6 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:   'select',
                id:    'branch_id',
                lbl:   'Sucursal:',
                class: 'col-12 col-md-3 col-lg-2',
                data:  []
            },
            {
                opc:      'select',
                id:       'fMotivo',
                lbl:      'Motivo:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: '-- Todos --' }].concat(this.dataInit.motivos || [])
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-6 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    'Aplicada',
                data: [
                    { id: '',          valor: '-- Todos --' },
                    { id: 'Aplicada',  valor: 'Aplicada' },
                    { id: 'Cancelada', valor: 'Cancelada' }
                ]
            }
        ];

        if (can('agregar')) {
            filters.push({
                opc:       'button',
                id:        'btnNuevaSalida',
                text:      'Nueva Salida',
                color_btn: 'primary',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => salidas.openSalidaForm()
            });
        }

        this.createfilterBar({ parent: 'filterBar', coffeesoft: true, theme: 'light', data: filters });

        const range = this.invRangePicker({
            parent:   'fRango',
            onSelect: (fi, ff) => {
                this.rangeFi = fi;
                this.rangeFf = ff;
                this.onChangeFilters();
            }
        });

        this.rangeFi = range.fi;
        this.rangeFf = range.ff;
    }

    // La sucursal es la de la barra de arriba: el select queda fijo en ella.
    populateFilters() {
        const $branch = $('#branch_id');

        $branch.empty();
        (this.dataInit.sucursales || []).forEach((s) => $branch.append($('<option>', { value: s.id, text: s.valor })));
        $branch.val(String(this.subId)).prop('disabled', true);
    }

    getFilters() {
        return {
            branch_id: this.subId || '',
            fi:        this.rangeFi || '',
            ff:        this.rangeFf || '',
            motivo:    $('#fMotivo').val() || '',
            status:    $('#fEstado').val() || ''
        };
    }

    async onChangeFilters() {
        salidas.lsSalidas();
        await salidas.lsKpis();
    }

    // Renglón de la salida abierta en el visor.
    markRow(id) {
        this.selectedId = id || null;

        const $rows = $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!this.selectedId) return;

        $rows.filter(function () {
            return $(this).find(`[onclick*="getSalida(${id})"]`).length > 0;
        }).addClass('row-active');
    }
}

class Salidas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'salidas';
    }

    filterData(opc, extra = {}) {
        const f = app.getFilters();

        return Object.assign({ opc, branch_id: f.branch_id, reason_id: f.motivo, status: f.status, fi: f.fi, ff: f.ff }, extra);
    }

    // Columnas: Folio, Fecha, Tipo, Sucursal, Origen [, Costo], Estado, Registrado
    async lsSalidas() {
        const r     = await useFetch({ url: apiSalidas, data: this.filterData('lsSalidas') });
        const data  = (r && r.status === 200) ? { row: r.row } : { row: [] };
        const costs = app.dataInit.costs;

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       costs ? [2, 3, 4, 7, 8] : [2, 3, 4, 6, 7],
            right:        costs ? [6] : [],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron salidas con los filtros aplicados',
            emptyIcon:    'icon-trash-empty',
            data
        });

        if (window.lucide) lucide.createIcons();

        if ((data.row || []).length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        app.markRow(app.selectedId);
    }

    async lsKpis() {
        const r = await useFetch({ url: apiSalidas, data: this.filterData('showSalidas') });
        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            app.dataInit.costs
                ? { id: 'kpiPerdida', label: 'Valor de salidas', value: invMoney(c.total_costo), tone: 'default' }
                : { id: 'kpiMermas', label: 'Mermas', value: parseInt(c.total_mermas || 0, 10), tone: 'default' },
            { id: 'kpiRegistros',  label: 'Registros',  value: parseInt(c.total_salidas || 0, 10),    tone: 'default' },
            { id: 'kpiUnidades',   label: 'Unidades',   value: invQty(c.total_unidades),              tone: 'warning' },
            { id: 'kpiCanceladas', label: 'Canceladas', value: parseInt(c.total_canceladas || 0, 10), tone: 'danger' }
        ];

        salidasView.renderInfoCards(kpis);
    }

    async lsKpiDetail(kpi) {
        const costs = app.dataInit.costs;
        const views = {
            kpiPerdida:    { title: 'Valor de salidas por producto', center: [2, 3], right: [4, 5] },
            kpiMermas:     { title: 'Mermas por motivo',             center: [2, 3], right: [4] },
            kpiRegistros:  { title: 'Registros por tipo de salida',  center: [2, 3], right: costs ? [4, 5] : [4] },
            kpiUnidades:   { title: 'Unidades por producto',         center: [2, 3], right: [4] },
            kpiCanceladas: { title: 'Salidas canceladas',            center: [2, 3, 4], right: costs ? [7] : [], size: 'xl' }
        };
        const view = views[kpi.id];

        if (!view) return;

        const r = await useFetch({ url: apiSalidas, data: this.filterData('lsKpiDetail', { kpi: kpi.id }) });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cargar el desglose' });
            return;
        }

        const f = app.getFilters();

        salidasView.kpiDetailModal(Object.assign({}, view, {
            value:    kpi.value,
            subtitle: `Del ${moment(f.fi).format('DD/MM/YYYY')} al ${moment(f.ff).format('DD/MM/YYYY')} · ${app.dataInit.branch}`,
            data:     { row: r.row || [] }
        }));
    }

    async getSalida(id) {
        const r = await useFetch({ url: apiSalidas, data: { opc: 'getSalida', id } });

        if (r && r.status === 200) {
            salidasView.renderDetail(this.mapSalidaDetail(r.header || {}, r.detail || []));
        } else {
            salidasView.renderDetail(null);
            if (r && r.message) this.alertBox({ type: 'error', title: r.message });
        }
    }

    mapSalidaDetail(h, detail) {
        const created = String(h.created_at || '');
        const ev      = h.evidence_url || '';
        const ver     = String(h.updated_at || h.created_at || '').replace(/[^0-9]/g, '');

        return {
            id:             h.id,
            folio:          h.folio,
            status:         h.status || '',
            sistema:        !!Number(h.is_system) || !!Number(h.is_sale),
            editadoPor:     h.edited_user_name ? `${h.edited_user_name}${h.edited_at ? ' · ' + moment(h.edited_at).format('DD/MM/YYYY HH:mm') : ''}` : '',
            merma:          !!Number(h.is_loss),
            motivo:         h.reason_name  || '',
            motivo_color:   h.reason_color || '',
            motivo_icon:    h.reason_icon  || '',
            fecha:          created ? created.replace(' ', 'T') : '',
            sucursal:       h.branch_name || '',
            almacen:        h.warehouse_name || '',
            registrado_por: h.user_name ? { name: h.user_name } : null,
            cancelado:      h.cancelled_user_name ? `${h.cancelled_user_name} · ${moment(h.cancelled_at).format('DD/MM/YYYY HH:mm')}` : '',
            motivoCancel:   h.cancel_reason || '',
            nota:           h.note || '',
            foto:           ev ? ev + (ev.indexOf('?') === -1 ? '?' : '&') + 'v=' + ver : '',
            items: (detail || []).map((d) => ({
                name:        d.product_name,
                sku:         d.sku,
                unidad:      d.unit || '',
                qty:         Number(d.quantity || 0),
                costo_unit:  Number(d.cost || 0),
                costo_total: Number(d.subtotal || 0),
                lote:        d.batch_code || '',
                caduca:      d.expires_at || ''
            })),
            total_unidades: Number(h.total_units || 0),
            total_costo:    Number(h.total_cost || 0)
        };
    }

    openSalidaForm() {
        const form = this.salidaFormInstance();
        form.setData({ branch_id: app.subId, fecha: moment().format('YYYY-MM-DD') });
        form.open();
    }

    salidaFormInstance() {
        if (this.salidaFormApi) return this.salidaFormApi;

        this.salidaFormApi = new InvSalidaForm({
            parent: 'body',
            id:     'salidaFormModal',
            json:   app.dataInit.productos || [],
            labels: {
                subtitle: 'Lo que sale del almacén: consumo, degustación o merma',
                fotoLbl:  'Foto de evidencia (la merma la pide)'
            },
            data: {
                motivos:    (app.dataInit.motivos || []).filter((m) => m.capture),
                sucursales: app.dataInit.sucursales || [],
                almacenes:  app.dataInit.almacenes || [],
                fecha:      moment().format('YYYY-MM-DD'),
                branch_id:  app.subId
            },
            onWarehouseChange: async (warehouseId, cb) => {
                if (!warehouseId) { cb({}); return; }

                const r = await useFetch({ url: apiSalidas, data: { opc: 'lsStockByWarehouse', warehouse_id: warehouseId } });
                cb((r && r.status === 200) ? (r.stock || {}) : {});
            },
            onSubmit: async (payload) => {
                const backend = {
                    note:                payload.nota || null,
                    evidence_b64:        payload.photo ? payload.photo.dataUrl : null,
                    shrinkage_reason_id: payload.motivo,
                    warehouse_id:        payload.warehouseId,
                    branch_id:           payload.sucursalId,
                    date_outflow:        payload.fecha,
                    productos:           payload.items.map((it) => ({ product_id: it.id, quantity: it.qty }))
                };

                const r = await useFetch({ url: apiSalidas, data: { opc: 'saveSalida', payload: JSON.stringify(backend) } });

                // La salida recién creada se abre en el visor.
                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || ('Salida ' + r.folio + ' registrada'), timer: 2200 });
                    this.lsSalidas();
                    this.lsKpis();
                    if (r.id) this.getSalida(r.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo registrar la salida' });
                }
            },
            onUpdate: (payload) => this.updateSalida(payload)
        });

        this.salidaFormApi.tpl = this;

        return this.salidaFormApi;
    }

    async printSalida(arg) {
        let m = arg;

        if (!m || typeof m !== 'object') {
            const r = await useFetch({ url: apiSalidas, data: { opc: 'getSalida', id: arg } });

            if (!(r && r.status === 200)) {
                this.alertBox({ type: 'error', title: 'No se pudo cargar la salida para imprimir' });
                return;
            }

            m = this.mapSalidaDetail(r.header || {}, r.detail || []);
        }

        this.renderSalidaDoc(m);
    }

    // El comprobante con firmas de almacenista y supervisor (el de inventory).
    renderSalidaDoc(m) {
        const esc      = invEsc;
        const costs    = app.dataInit.costs;
        const fmtMoney = invMoney;
        const fmtUds   = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const DOW      = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const MON      = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fmtFecha = (iso) => {
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

        const items    = m.items || [];
        const rowsHtml = items.map((it) => `<tr><td class="prod"><span class="prod-name">${esc(it.name)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}${it.lote ? `<div class="pres">Lote ${esc(it.lote)}</div>` : ''}</td><td class="c">-${fmtUds(it.qty)}</td>${costs ? `<td class="r">${fmtMoney(it.costo_unit)}</td><td class="r">-${fmtMoney(it.costo_total)}</td>` : ''}<td class="c">${esc(it.unidad || '-')}</td></tr>`).join('');
        const reg      = m.registrado_por && m.registrado_por.name ? m.registrado_por.name : '-';

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Salida ${esc(m.folio || '')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800;color:#000}.folio{font-size:20px;font-weight:800;color:#000;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px;color:#000}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right;color:#000}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2;color:#000}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.pres{color:#555;font-size:10px;font-style:italic;margin-top:1px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}.firmas{display:flex;justify-content:space-between;gap:64px;margin-top:72px;page-break-inside:avoid}.firma{flex:1;text-align:center;font-size:11px;color:#000}.firma .linea{border-top:1px solid #000;margin-bottom:6px}.firma .rol{font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px}.firma .sub{color:#777;font-size:10px;margin-top:2px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Comprobante de Salida</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(m.sucursal || '')}${m.almacen ? ' &middot; ' + esc(m.almacen) : ''}</div></div><div><div class="folio">${esc(m.folio || '-')}</div>${m.status ? `<span class="status">${esc(m.status)}</span>` : ''}</div></div>
            <div class="info-grid"><div class="info-item"><span class="k">Tipo de salida</span><span class="v">${esc(m.motivo || '-')}</span></div><div class="info-item"><span class="k">Fecha</span><span class="v">${esc(fmtFecha(m.fecha))}</span></div><div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(m.sucursal || '-')}</span></div><div class="info-item"><span class="k">Almacén</span><span class="v">${esc(m.almacen || '-')}</span></div><div class="info-item"><span class="k">Registrado por</span><span class="v">${esc(reg)}</span></div></div>
            <table><thead><tr><th>Producto</th><th class="c">Cant</th>${costs ? '<th class="r">Costo unit.</th><th class="r">Importe</th>' : ''}<th class="c">Unidad</th></tr></thead><tbody>${rowsHtml || `<tr><td colspan="${costs ? 5 : 3}" class="c">Sin productos</td></tr>`}</tbody></table>
            <div class="totals"><div class="totals-box"><div class="totals-row"><span>Tipos de producto</span><span>${items.length}</span></div><div class="totals-row${costs ? '' : ' grand'}"><span>Unidades</span><span>-${fmtUds(m.total_unidades)}</span></div>${costs ? `<div class="totals-row grand"><span>Valor de salidas</span><span>-${fmtMoney(m.total_costo)}</span></div>` : ''}</div></div>
            ${m.nota ? `<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;color:#222"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(m.nota)}</div>` : ''}
            <div class="firmas"><div class="firma"><div class="linea"></div><div class="rol">Almacenista</div><div class="sub">Nombre y firma</div></div><div class="firma"><div class="linea"></div><div class="rol">Supervisor</div><div class="sub">Nombre y firma</div></div></div>
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

    // -- Editar (R2) --

    // Contraseña primero; luego la captura abierta con los renglones de la salida.
    async openEditSalida(id) {
        const r = await useFetch({ url: apiSalidas, data: { opc: 'getSalida', id } });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo abrir la salida' });
            return;
        }

        const h = r.header || {};

        if (h.adjustment_date && String(h.operation_date) < String(h.adjustment_date)) {
            this.alertBox({
                type:       'warning',
                title:      'Ya hubo un conteo físico después',
                detailHtml: `El almacén se contó el ${moment(h.adjustment_date).format('DD/MM/YYYY')}: una salida anterior ya no se edita.`
            });
            return;
        }

        const ok = await this.invAskPassword({ url: apiSalidas, doc: 'outflow-edit', id: h.id, hint: 'Para editar la salida escribe tu contraseña.' });
        if (!ok) return;

        const catalog = app.dataInit.productos || [];

        this.salidaFormInstance().openEdit({
            id:           h.id,
            folio:        h.folio,
            motivo:       h.outflow_reason_id,
            branch_id:    h.branch_id,
            warehouse_id: h.warehouse_id,
            fecha:        h.operation_date,
            nota:         h.note || '',
            evidence:     !!h.evidence_url,
            productos:    (r.detail || []).map((d) => {
                const prod = catalog.find((p) => String(p.id) === String(d.product_id));

                return Object.assign({}, prod || { id: d.product_id, nombre: d.product_name, sku: d.sku, unidad: d.unit, costo: d.cost }, { cantidad: Number(d.quantity || 0) });
            })
        });
    }

    async updateSalida(payload) {
        const backend = {
            id:                  payload.id,
            note:                payload.nota || null,
            shrinkage_reason_id: payload.motivo,
            warehouse_id:        payload.warehouseId,
            branch_id:           payload.sucursalId,
            date_outflow:        payload.fecha,
            has_photo:           payload.photo ? 1 : 0,
            productos:           payload.items.map((it) => ({ product_id: it.id, quantity: it.qty }))
        };

        let r = await useFetch({ url: apiSalidas, data: { opc: 'updateSalida', payload: JSON.stringify(backend) } }).catch(() => null);

        // Pasaron los 10 minutos de la contraseña: se pide otra vez y se reintenta.
        if (r && r.status === 403) {
            const ok = await this.invAskPassword({ url: apiSalidas, doc: 'outflow-edit', id: payload.id, hint: r.message });
            if (!ok) return;
            r = await useFetch({ url: apiSalidas, data: { opc: 'updateSalida', payload: JSON.stringify(backend) } }).catch(() => null);
        }

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar la salida' });
            return;
        }

        if (payload.photo && payload.photo.dataUrl) {
            await useFetch({ url: apiSalidas, data: { opc: 'saveSalidaEvidence', id: payload.id, evidence_b64: payload.photo.dataUrl } }).catch(() => null);
        }

        this.alertBox({ type: 'success', title: r.message || 'Salida actualizada', timer: 2200 });
        this.lsSalidas();
        this.lsKpis();
        this.getSalida(payload.id);
    }

    // Contraseña, luego el motivo (queda en el kárdex), y se cancela.
    async cancelSalida(m) {
        const ok = await this.invAskPassword({ url: apiSalidas, doc: 'outflow', id: m.id, hint: 'Para cancelar la salida escribe tu contraseña.' });
        if (!ok) return;

        const reason = await this.invAskReason({
            title:  `Cancelar salida ${m.folio || ''}`.trim(),
            detail: 'Lo que salió regresa al almacén y la salida pasa a Cancelada.'
        });
        if (!reason) return;

        const r = await useFetch({ url: apiSalidas, data: { opc: 'cancelSalida', id: m.id, reason } }).catch(() => null);

        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message || 'Salida cancelada', timer: 2200 });
            salidasView.renderDetail(null);
            this.lsSalidas();
            this.lsKpis();
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar' });
        }
    }

    async uploadEvidence(id, dataUrl) {
        if (!dataUrl) return;

        const r = await useFetch({ url: apiSalidas, data: { opc: 'saveSalidaEvidence', id, evidence_b64: dataUrl } });

        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message || 'Evidencia actualizada', timer: 2200 });
            this.getSalida(id);
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar la evidencia' });
        }
    }

    removeEvidence(id) {
        this.alertBox({
            type:        'cancel',
            title:       '¿Quitar evidencia?',
            detailHtml:  'Se eliminará la foto de evidencia de esta salida.',
            okLabel:     'Sí, quitar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiSalidas, data: { opc: 'saveSalidaEvidence', id, evidence_b64: '' } });

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Evidencia eliminada', timer: 2200 });
                    this.getSalida(id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo eliminar la evidencia' });
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

    // El folio o el ojo abren el visor y marcan su renglón; la X o cancelar lo ocultan.
    renderDetail(salida) {
        this.salidaDetailPanel({
            parent: 'detailPanel',
            json:   salida,
            costs:  app.dataInit.costs,
            actions: {
                cancel:   can('cancelar'),
                edit:     can('editar'),
                evidence: can('agregar'),
                print:    can('imprimir')
            },
            onClose:          () => this.renderDetail(null),
            onEditar:         (m) => { if (m) salidas.openEditSalida(m.id); },
            onImprimir:       (m) => { if (m) salidas.printSalida(m); },
            onCancelar:       (m) => { if (m) salidas.cancelSalida(m); },
            onUploadEvidence: (m, dataUrl) => { if (m) salidas.uploadEvidence(m.id, dataUrl); },
            onRemoveEvidence: (m) => { if (m) salidas.removeEvidence(m.id); }
        });

        invToggleVisor(!!salida);
        app.markRow(salida ? salida.id : null);
    }

    renderInfoCards(rows) {
        this.invKpisRow({ parent: 'kpisRow', json: rows, onClick: (kpi) => salidas.lsKpiDetail(kpi) });
    }

    renderHeader(data) {
        this.viewHeader({ parent: 'viewHeader', json: data });
    }

    // -- Visor de la derecha (el de inventory) --

    salidaDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'salidaDetailPanel',
            class:  'flex-1 min-h-0 flex flex-col overflow-hidden',
            json:   null,
            costs:  true,
            labels: {
                emptyTitle:   'Selecciona una salida',
                emptyHint:    'Haz click en el folio o en el ícono del ojo para ver el detalle aquí.',
                subtitleLbl:  'Detalle de la salida',
                motivo:       'Tipo de salida',
                fecha:        'Fecha',
                sucursal:     'Sucursal',
                almacen:      'Almacén',
                registrado:   'Registrado',
                productos:    'Productos',
                notaLbl:      'Nota',
                evidenciaLbl: 'Evidencia',
                sinFoto:      'Sin foto de evidencia',
                subirFoto:    'Subir evidencia',
                cambiarFoto:  'Cambiar',
                quitarFoto:   'Quitar',
                imprimir:     'Imprimir',
                cancelar:     'Cancelar'
            },
            statusPalettes: {
                'Aplicada':  { bg: '#DCFCE7', fg: '#16A34A' },
                'Cancelada': { bg: '#FEE2E2', fg: '#DC2626' }
            },
            actions:          { cancel: true, edit: false, evidence: true, print: true },
            onClose:          () => {},
            onEditar:         () => {},
            onImprimir:       () => {},
            onCancelar:       () => {},
            onUploadEvidence: () => {},
            onRemoveEvidence: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.statusPalettes = Object.assign({}, defaults.statusPalettes, o.statusPalettes || {});
        opts.actions        = Object.assign({}, defaults.actions,        o.actions        || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc      = invEsc;
        const fmtMoney = invMoney;
        const costs    = !!opts.costs;
        const hexToRgba = (hex, a) => {
            const hh = String(hex || '').trim().replace('#', '');
            if (hh.length !== 6) return '';
            const rv = parseInt(hh.slice(0, 2), 16);
            const gv = parseInt(hh.slice(2, 4), 16);
            const bv = parseInt(hh.slice(4, 6), 16);
            return [rv, gv, bv].some(isNaN) ? '' : `rgba(${rv},${gv},${bv},${a})`;
        };

        const DOW      = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const MON      = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            let hh = d.getHours();
            const mi   = String(d.getMinutes()).padStart(2, '0');
            const ampm = hh >= 12 ? 'pm' : 'am';
            hh = hh % 12 || 12;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mi} ${ampm}`;
        };

        // La foto se reduce a 1280 px en JPEG antes de subirla.
        const compressImage = (file, cb) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const max = 1280;
                    let w = img.width;
                    let h = img.height;
                    if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    cb(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => cb(ev.target.result);
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };

        const infoRow = (label, value) => `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(label)}</span>${value}</div>`;
        const text    = (value) => `<span class="text-gray-700 text-right">${esc(value)}</span>`;

        const emptyView = () => `
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                <i data-lucide="inbox" class="w-10 h-10 text-gray-300 mb-3"></i>
                <p class="text-sm font-semibold text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                <p class="text-xs text-gray-400 mt-1 max-w-[200px]">${esc(opts.labels.emptyHint)}</p>
            </div>
        `;

        const productTable = (m) => {
            const rows = (m.items || []).map((it) => `
                <tr class="border-b border-gray-100 last:border-b-0 align-top">
                    <td class="!py-1 !pl-2 !pr-2">
                        <p class="text-[11px] font-medium text-gray-700 leading-tight">${esc(it.name)}${it.sku ? ` <span class="text-[10px] font-normal text-gray-400">${esc(it.sku)}</span>` : ''}</p>
                        ${it.lote ? `<p class="text-[10px] text-gray-400 leading-tight mt-0.5">Lote ${esc(it.lote)}${it.caduca ? ' · Caduca ' + esc(moment(it.caduca).format('DD/MM/YYYY')) : ''}</p>` : ''}
                    </td>
                    ${costs ? `<td class="!py-1 !px-1 text-right text-[11px] text-gray-500 whitespace-nowrap">${fmtMoney(it.costo_unit)}</td>` : ''}
                    <td class="!py-1 !px-1 text-center text-[11px]"><span class="font-semibold text-gray-800">-${invQty(it.qty)}</span></td>
                    ${costs ? `<td class="!py-1 !px-1 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap">-${fmtMoney(it.costo_total)}</td>` : ''}
                    <td class="!py-1 !pl-1 !pr-2 text-center text-[11px] text-gray-500">${esc(it.unidad || '-')}</td>
                </tr>`).join('');

            return `
                <div class="rounded-lg overflow-hidden border border-gray-200 dark:!border-0">
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                                <th class="text-left font-semibold text-[10px] !py-1.5 !pl-2 !pr-2">Producto</th>
                                ${costs ? '<th class="text-right font-semibold text-[10px] !py-1.5 !px-1">Precio</th>' : ''}
                                <th class="text-center font-semibold text-[10px] !py-1.5 !px-1">Cant</th>
                                ${costs ? '<th class="text-right font-semibold text-[10px] !py-1.5 !px-1">Importe</th>' : ''}
                                <th class="text-center font-semibold text-[10px] !py-1.5 !pl-1 !pr-2">Unidad</th>
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="${costs ? 5 : 3}" class="py-2 text-center text-xs text-gray-400">Sin productos</td></tr>`}</tbody>
                    </table>
                </div>`;
        };

        const fotoHtml = (foto, editable) => {
            const input = editable ? `<input type="file" id="${opts.id}_evdInput" accept="image/*" capture="environment" class="hidden">` : '';
            const btn   = 'w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors';

            if (!foto) {
                return editable
                    ? `${input}<button type="button" id="${opts.id}_evdUpload" class="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"><i data-lucide="upload" class="w-3 h-3"></i>${esc(opts.labels.subirFoto)}</button>`
                    : `<span class="text-gray-400">${esc(opts.labels.sinFoto)}</span>`;
            }

            const view = `<a href="${esc(foto)}" target="_blank" rel="noopener"><img src="${esc(foto)}" alt="${esc(opts.labels.evidenciaLbl)}" class="w-8 h-8 rounded object-cover border border-gray-200"></a>`;
            const edit = editable
                ? `<button type="button" id="${opts.id}_evdUpload" class="${btn} hover:text-blue-600" title="${esc(opts.labels.cambiarFoto)}"><i data-lucide="refresh-cw" class="w-3 h-3"></i></button>
                   <button type="button" id="${opts.id}_evdRemove" class="${btn} hover:text-red-500" title="${esc(opts.labels.quitarFoto)}"><i data-lucide="trash-2" class="w-3 h-3"></i></button>`
                : '';

            return `${input}<span class="flex items-center gap-1">${view}${edit}</span>`;
        };

        const filledView = (m) => {
            const motivoBg    = hexToRgba(m.motivo_color, 0.12) || 'rgba(156,163,175,0.18)';
            const motivoFg    = m.motivo_color || '#9CA3AF';
            const motivoBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:${motivoBg};color:${motivoFg};"><i data-lucide="${esc(m.motivo_icon || 'alert-triangle')}" class="w-3 h-3"></i>${esc(m.motivo || '-')}</span>`;
            const stC         = opts.statusPalettes[m.status] || { bg: 'rgba(156,163,175,0.15)', fg: '#9CA3AF' };
            const reg         = m.registrado_por && m.registrado_por.name ? m.registrado_por.name : '-';
            const vigente     = m.status !== 'Cancelada';
            const canCancel   = vigente && !m.sistema && opts.actions.cancel;
            const canEdit     = vigente && !m.sistema && opts.actions.edit;

            return `
                <div class="flex-1 flex flex-col overflow-hidden">
                    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 dark:!border-0 flex items-center justify-between flex-shrink-0">
                        <div>
                            <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitleLbl)}</p>
                            <p class="text-base font-bold text-gray-800">${esc(m.folio || '-')}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            ${m.status ? `<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:${stC.bg};color:${stC.fg};">${esc(m.status)}</span>` : ''}
                            ${opts.actions.print ? `<button id="${opts.id}_print" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="${esc(opts.labels.imprimir)}"><i data-lucide="printer" class="w-3.5 h-3.5"></i></button>` : ''}
                            <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="Cerrar"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>

                    <div class="px-4 py-3 border-b border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                        ${infoRow(opts.labels.motivo, motivoBadge)}
                        ${infoRow(opts.labels.fecha, text(fmtFecha(m.fecha)))}
                        ${infoRow(opts.labels.sucursal, text(m.sucursal || '-'))}
                        ${infoRow(opts.labels.almacen, text(m.almacen || '-'))}
                    </div>

                    <div id="${opts.id}_scroll" class="flex-1 overflow-y-auto px-4 py-2">
                        <p class="text-xs uppercase tracking-wider text-gray-500 mb-1">${esc(opts.labels.productos)} (${(m.items || []).length})</p>
                        ${productTable(m)}
                    </div>

                    <div class="cs-visor-totals px-4 py-2.5 border-t border-gray-200 dark:!border-0 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center justify-between ${costs ? 'text-xs text-gray-500 mb-1' : ''}">
                            <span class="${costs ? '' : 'text-sm font-semibold text-gray-700'}">Unidades</span>
                            <span class="${costs ? 'font-semibold text-gray-700' : 'text-lg font-bold text-gray-800'}">-${invQty(m.total_unidades)}</span>
                        </div>
                        ${costs ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-semibold text-gray-700">Total general</span>
                            <span class="text-lg font-bold text-gray-800">-${fmtMoney(m.total_costo)}</span>
                        </div>` : ''}
                    </div>

                    <div class="px-4 py-2.5 border-t border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                        ${infoRow(opts.labels.registrado, text(reg))}
                        ${m.editadoPor ? infoRow('Editado', text(m.editadoPor)) : ''}
                        ${m.cancelado ? infoRow('Cancelado', text(m.cancelado)) : ''}
                        ${m.motivoCancel ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">Motivo</span>${text(m.motivoCancel)}</div>` : ''}
                        ${m.nota ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(opts.labels.notaLbl)}</span>${text(m.nota)}</div>` : ''}
                        ${infoRow(opts.labels.evidenciaLbl, fotoHtml(m.foto, vigente && opts.actions.evidence))}
                    </div>

                    ${canCancel || canEdit ? `
                    <div class="px-4 py-3 border-t border-gray-200 dark:!border-0 flex gap-2 flex-shrink-0">
                        ${canEdit ? `<button id="${opts.id}_edit" class="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg border-[1px] border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center gap-1.5"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button>` : ''}
                        ${canCancel ? `<button id="${opts.id}_cancel" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5"><i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.cancelar)}</button>` : ''}
                    </div>` : ''}
                </div>
            `;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });
        aside.html(opts.json ? filledView(opts.json) : emptyView());

        $parent.html(aside);
        if (window.lucide) lucide.createIcons();

        if (!opts.json) return;

        const m = opts.json;

        $(`#${opts.id}_close`).on('click',  () => opts.onClose(m));
        $(`#${opts.id}_print`).on('click',  () => opts.onImprimir(m));
        $(`#${opts.id}_cancel`).on('click', () => opts.onCancelar(m));
        $(`#${opts.id}_edit`).on('click',   () => opts.onEditar(m));

        if (m.status !== 'Cancelada') {
            const $input = $(`#${opts.id}_evdInput`);

            $(`#${opts.id}_evdUpload`).on('click', () => $input.trigger('click'));
            $input.on('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) compressImage(file, (dataUrl) => opts.onUploadEvidence(m, dataUrl));
            });
            $(`#${opts.id}_evdRemove`).on('click', (e) => { e.stopPropagation(); opts.onRemoveEvidence(m); });
        }
    }
}
