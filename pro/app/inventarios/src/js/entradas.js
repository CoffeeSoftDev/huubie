// -- Entradas --
// La pantalla de inventory/operacion/almacen/entradas aplicada al Catálogo de
// pro: visor con filtros, tarjetas KPI, tabla y el detalle a la derecha. La
// captura es entrada-form.js (la de inventory). La producción nace Pendiente y
// se confirma desde el detalle con lo que de verdad salió.
// Comunes (can, invEsc, viewHeader, kpisRow...) en inventarios.js.

let apiEntradas = 'ctrl/ctrl-entradas.php';
let app, entradas, entradasView;

const VIEW_HEADER_ENTRADAS = {
    title:    'Entradas de Inventario',
    subtitle: 'Recepciones de producción, compras y devoluciones por sucursal'
};

$(async () => {
    entradasView = new EntradasView(apiEntradas, 'root');
    entradas     = new Entradas(apiEntradas, 'root');
    app          = new App(apiEntradas, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'entradas';
        this.subId        = null;
        this.selectedId   = null;
        this.rangeFi      = '';
        this.rangeFf      = '';
    }

    async init() {
        const r = await useFetch({ url: apiEntradas, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch_id:   r.branch_id || '',
            branch:      (r.scope || {}).branch || '',
            sucursales:  r.sucursales       || [],
            origenes:    r.origenes_entrada || [],
            estados:     r.estados_entrada  || [],
            almacenes:   r.almacenes        || [],
            areas:       r.areas            || [],
            categorias:  r.categorias       || [],
            unidades:    r.unidades         || [],
            proveedores: r.proveedores      || [],
            productos:   r.productos        || [],
            costs:       !!r.costs,
            ajustes:     r.ajustes          || {}
        };
        this.subId = this.dataInit.branch_id;

        this.render();
    }

    render() {
        this.invVisorLayout({ id: this.PROJECT_NAME, key: 'entradas' });
        this.visorResize({ key: 'entradas', label: 'Ancho del detalle de recepción' });
        this.filterBar();
        entradasView.renderDetail(null);
        this.populateFilters();
        this.updateHeaderTitle();
        entradas.lsEntradas();
        entradas.lsKpis();
    }

    updateHeaderTitle() {
        entradasView.renderHeader(Object.assign({}, VIEW_HEADER_ENTRADAS, {
            titleHtml: invTitleHtml(VIEW_HEADER_ENTRADAS.title, this.dataInit.branch)
        }));
    }

    // Captura quien tenga «agregar» o «producir» y algún tipo que su rol pueda capturar.
    canCapture() {
        return (this.dataInit.origenes || []).some((o) => o.capture);
    }

    filterBar() {
        const filters = [
            {
                opc:         'input-calendar',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-4 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:   'select',
                id:    'branch_id',
                lbl:   'Sucursal:',
                class: 'col-12 col-md-4 col-lg-2',
                data:  []
            },
            {
                opc:      'select',
                id:       'fOrigen',
                lbl:      'Tipo de entrada:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: '-- Todos --' }].concat(this.dataInit.origenes || [])
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-6 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    'Activas',
                data:     this.dataInit.estados || []
            }
        ];

        if (this.canCapture()) {
            filters.push({
                opc:       'button',
                id:        'btnNuevaEntrada',
                text:      'Agregar Entrada',
                color_btn: 'primary',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => entradasView.openNuevaEntrada()
            });
        }

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

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
            origen:    $('#fOrigen').val() || '',
            estado:    $('#fEstado').val() || '',
            fi:        this.rangeFi || '',
            ff:        this.rangeFf || ''
        };
    }

    async onChangeFilters() {
        entradas.lsEntradas();
        await entradas.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) this.selectEntrada(null);
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    // El folio y el ojo abren el visor; la X, cancelar/confirmar o un filtro que
    // esconde la entrada lo vuelven a ocultar.
    selectEntrada(folio, id) {
        this.selectedId = folio;
        invMarkRow(`tb${this.PROJECT_NAME}`, folio);

        if (folio) {
            invToggleVisor(true);
            entradas.getEntrada(id);
            return;
        }

        entradasView.renderDetail(null);
        invToggleVisor(false);
    }
}

class Entradas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'entradas';
    }

    filterData(opc, extra = {}) {
        const f = app.getFilters();

        return Object.assign({ opc, branch_id: f.branch_id, origin_id: f.origen, status: f.estado, fi: f.fi, ff: f.ff }, extra);
    }

    // Columnas: Folio, Fecha, Tipo de entrada, Sucursal, Origen [, Costo], Estado, Registrado
    async lsEntradas() {
        const r     = await useFetch({ url: apiEntradas, data: this.filterData('lsEntradas') });
        const data  = (r && r.status === 200) ? { row: r.row } : { row: [] };
        const costs = app.dataInit.costs;

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       costs ? [2, 3, 7] : [2, 3, 6],
            right:        costs ? [6] : [],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron entradas con los filtros aplicados',
            emptyIcon:    'icon-arrow-down-to-line',
            data
        });

        // Los íconos antes de paginar: DataTables saca del documento las filas de las otras páginas.
        if (window.lucide) lucide.createIcons();

        if ((data.row || []).length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        if (app.selectedId) invMarkRow(`tb${this.PROJECT_NAME}`, app.selectedId);
    }

    async lsKpis() {
        const r = await useFetch({ url: apiEntradas, data: this.filterData('showEntradas') });
        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiEntradas', label: 'Entradas', value: parseInt(c.total_entradas || 0, 10), tone: 'success' },
            app.dataInit.costs
                ? { id: 'kpiCosto', label: 'Costo Total', value: invMoney(c.total_costo), tone: 'default' }
                : { id: 'kpiPendientes', label: 'Pendientes', value: parseInt(c.total_pendientes || 0, 10), tone: 'default' },
            { id: 'kpiUnidades', label: 'Unidades', value: invQty(c.total_unidades), tone: 'warning' },
            { id: 'kpiAplicadas', label: 'Aplicadas', value: parseInt(c.total_aplicadas || 0, 10), tone: 'purple' }
        ];

        entradasView.renderInfoCards(kpis);
    }

    async lsKpiDetail(kpi) {
        const costs = app.dataInit.costs;
        const views = {
            kpiEntradas:  { title: 'Entradas por tipo de entrada', center: [2, 3], right: costs ? [4, 5] : [4] },
            kpiCosto:     { title: 'Costo total por producto',     center: [2, 3], right: [4, 5] },
            kpiUnidades:  { title: 'Unidades por producto',        center: [2, 3], right: [4] },
            kpiAplicadas: { title: 'Entradas aplicadas',           center: [2, 3, 5], right: costs ? [6] : [], size: 'xl' }
        };
        const view = views[kpi.id];

        if (!view) return;

        const r = await useFetch({ url: apiEntradas, data: this.filterData('lsKpiDetail', { kpi: kpi.id }) });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cargar el desglose' });
            return;
        }

        const f = app.getFilters();

        entradasView.kpiDetailModal(Object.assign({}, view, {
            value:    kpi.value,
            subtitle: `Del ${moment(f.fi).format('DD/MM/YYYY')} al ${moment(f.ff).format('DD/MM/YYYY')} · ${app.dataInit.branch}`,
            data:     { row: r.row || [] }
        }));
    }

    async getEntrada(id) {
        const r = await useFetch({ url: apiEntradas, data: { opc: 'getEntrada', id } });

        if (r && r.status === 200) {
            entradasView.renderDetail(this.mapEntradaDetail(r.header || {}, r.detail || []));
        } else {
            entradasView.renderDetail(null);
            if (r && r.message) this.alertBox({ type: 'error', title: r.message });
        }
    }

    mapEntradaDetail(h, detail) {
        const raw = String(h.date_inflow || '');

        return {
            id:            h.id,
            folio:         h.folio,
            fechaIso:      raw.length <= 10 ? (raw ? raw + 'T00:00:00' : '') : raw.replace(' ', 'T'),
            estado:        h.status,
            origen:        h.origin_name,
            origenCode:    h.origin_code,
            sistema:       !!Number(h.is_system),
            origenBadge:   h.origin_badge || '',
            sucursal:      h.branch_name,
            almacen:       h.warehouse_name,
            destino:       h.area_name || '',
            proveedor:     h.supplier_name,
            factura:       h.invoice_folio || '',
            registrado:    h.user_name,
            confirmadoPor: h.confirmed_user_name ? `${h.confirmed_user_name} · ${moment(h.confirmed_at).format('DD/MM/YYYY HH:mm')}` : '',
            editadoPor:    h.edited_user_name ? `${h.edited_user_name} · ${moment(h.edited_at).format('DD/MM/YYYY HH:mm')}` : '',
            canceladoPor:  h.cancelled_user_name ? `${h.cancelled_user_name} · ${moment(h.cancelled_at).format('DD/MM/YYYY HH:mm')}` : '',
            motivo:        h.cancel_reason || '',
            nota:          h.note,
            comprobante:   h.voucher_url ? `${h.voucher_url}?v=${Date.now()}` : '',
            productos: (detail || []).map((d) => ({
                detailId:  d.id,
                nombre:    d.product_name,
                sku:       d.sku,
                unidad:    d.unit || '',
                decimals:  Number(d.decimals || 0),
                cant:      Number(d.quantity || 0),
                cantReal:  Number(d.quantity || 0),
                confirmada: false,
                costo:     Number(d.cost || 0),
                stockPrev: Number(d.previous_stock || 0),
                lote:      d.batch_code || '',
                caduca:    d.expires_at || '',
                image:     d.image || ''
            }))
        };
    }

    async printEntrada(arg) {
        let e = arg;

        if (!e || typeof e !== 'object') {
            const r = await useFetch({ url: apiEntradas, data: { opc: 'getEntrada', id: arg } });

            if (!(r && r.status === 200)) {
                this.alertBox({ type: 'error', title: 'No se pudo cargar la entrada para imprimir' });
                return;
            }

            e = this.mapEntradaDetail(r.header || {}, r.detail || []);
        }

        this.renderEntradaDoc(e);
    }

    // El comprobante en una ventana aparte, listo para imprimir (el de inventory).
    renderEntradaDoc(e) {
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

        const productos = e.productos || [];
        const totals    = productos.reduce((acc, it) => {
            acc.uds   += Number(it.cant || 0);
            acc.costo += Number(it.cant || 0) * Number(it.costo || 0);
            return acc;
        }, { uds: 0, costo: 0 });

        const rowsHtml = productos.map((it) => {
            const q  = Number(it.cant || 0);
            const cu = Number(it.costo || 0);
            return `<tr><td class="prod"><span class="prod-name">${esc(it.nombre)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td><td class="c">${fmtUds(q)}</td>${costs ? `<td class="r">${fmtMoney(cu)}</td><td class="r">${fmtMoney(q * cu)}</td>` : ''}<td class="c">${esc(it.unidad || '-')}</td></tr>`;
        }).join('');

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Entrada ${esc(e.folio || '')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800;color:#000}.folio{font-size:20px;font-weight:800;color:#000;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px;color:#000}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right;color:#000}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2;color:#000}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Comprobante de Entrada</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(e.sucursal || '')}${e.almacen ? ' &middot; ' + esc(e.almacen) : ''}</div></div><div><div class="folio">${esc(e.folio || '-')}</div>${e.estado ? `<span class="status">${esc(e.estado)}</span>` : ''}</div></div>
            <div class="info-grid"><div class="info-item"><span class="k">Tipo de entrada</span><span class="v">${esc(e.origen || '-')}</span></div>${e.proveedor ? `<div class="info-item"><span class="k">Proveedor</span><span class="v">${esc(e.proveedor)}</span></div>` : ''}${e.factura ? `<div class="info-item"><span class="k">Folio factura</span><span class="v">${esc(e.factura)}</span></div>` : ''}<div class="info-item"><span class="k">Fecha</span><span class="v">${esc(fmtFecha(e.fechaIso))}</span></div><div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(e.sucursal || '-')}</span></div><div class="info-item"><span class="k">Almacén</span><span class="v">${esc(e.almacen || '-')}</span></div>${e.destino ? `<div class="info-item"><span class="k">Área</span><span class="v">${esc(e.destino)}</span></div>` : ''}<div class="info-item"><span class="k">Registrado por</span><span class="v">${esc(e.registrado || '-')}</span></div></div>
            <table><thead><tr><th>Producto</th><th class="c">Cant</th>${costs ? '<th class="r">Costo unit.</th><th class="r">Importe</th>' : ''}<th class="c">Unidad</th></tr></thead><tbody>${rowsHtml || `<tr><td colspan="${costs ? 5 : 3}" class="c">Sin productos</td></tr>`}</tbody></table>
            <div class="totals"><div class="totals-box"><div class="totals-row"><span>Tipos de producto</span><span>${productos.length}</span></div><div class="totals-row${costs ? '' : ' grand'}"><span>Unidades</span><span>${fmtUds(totals.uds)}</span></div>${costs ? `<div class="totals-row grand"><span>Costo total</span><span>${fmtMoney(totals.costo)}</span></div>` : ''}</div></div>
            ${e.nota ? `<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;color:#222"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(e.nota)}</div>` : ''}
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

class EntradasView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'entradas';
    }

    renderDetail(entrada) {
        this.entradaDetailPanel({
            parent:  'detailPanel',
            json:    entrada,
            costs:   app.dataInit.costs,
            // La del sistema (el «Recibí» de una requisición) se corrige desde la requisición.
            actions: {
                cancel:  can('cancelar') && !(entrada && entrada.sistema),
                confirm: can('editar'),
                edit:    can('editar') && !(entrada && entrada.sistema),
                voucher: can('agregar') || can('editar'),
                print:   can('imprimir')
            },
            onClose:         () => app.selectEntrada(null),
            onPrint:         (e) => { if (e) entradas.printEntrada(e); },
            onEdit:          (e) => this.openEditEntrada(e.id),
            onReverse:       (e) => this.cancelEntrada(e),
            onConfirm:       (e) => this.confirmEntrada(e),
            onUploadVoucher: (e, file) => this.uploadVoucher(e, file),
            onRemoveVoucher: (e) => this.removeVoucher(e)
        });
    }

    async uploadVoucher(e, file) {
        let dataUrl;

        try {
            dataUrl = await EntradaForm.readVoucher(file);
        } catch (msg) {
            this.alertBox({ type: 'warning', title: msg });
            return;
        }

        const r = await useFetch({ url: apiEntradas, data: { opc: 'saveEntradaVoucher', id: e.id, voucher_b64: dataUrl } }).catch(() => null);

        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message || 'Comprobante guardado', timer: 1600 });
            entradas.getEntrada(e.id);
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar el comprobante' });
        }
    }

    removeVoucher(e) {
        this.alertBox({
            type:        'cancel',
            title:       '¿Quitar comprobante?',
            detailHtml:  'Se eliminará el archivo del comprobante de esta entrada.',
            okLabel:     'Sí, quitar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiEntradas, data: { opc: 'saveEntradaVoucher', id: e.id, voucher_b64: '' } }).catch(() => null);

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Comprobante eliminado', timer: 1600 });
                    entradas.getEntrada(e.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo quitar el comprobante' });
                }
            }
        });
    }

    // Contraseña, luego el motivo (queda en el kárdex), y se cancela.
    async cancelEntrada(e) {
        if (!e || !e.id) return;

        if (e.estado === 'Cancelada') {
            this.alertBox({ type: 'message', title: 'La entrada ya está cancelada' });
            return;
        }

        const ok = await this.invAskPassword({ url: apiEntradas, doc: 'inflow', id: e.id, hint: 'Para cancelar la entrada escribe tu contraseña.' });
        if (!ok) return;

        const reason = await this.invAskReason({
            title:  `Cancelar entrada ${e.folio || ''}`.trim(),
            detail: e.estado === 'Aplicada'
                ? 'Se restará del almacén lo que sumó y la entrada pasará a Cancelada.'
                : 'La orden de producción pasará a Cancelada sin mover el almacén.'
        });
        if (!reason) return;

        const r = await useFetch({ url: apiEntradas, data: { opc: 'reverseEntrada', id: e.id, reason } }).catch(() => null);

        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message || 'Entrada cancelada', timer: 1600 });
            app.selectEntrada(null);
            entradas.lsEntradas();
            entradas.lsKpis();
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar la entrada' });
        }
    }

    // Confirma con la cantidad que de verdad salió (los campos del visor).
    confirmEntrada(e) {
        if (!e || !e.id) return;

        if (e.estado !== 'Pendiente') {
            this.alertBox({ type: 'message', title: 'La entrada no está pendiente de confirmar' });
            return;
        }

        const quantities = {};
        let bad = '';

        $('#detailPanel .entrada-real-qty').each(function () {
            const val = parseFloat($(this).val());
            const p   = (e.productos || []).find((x) => String(x.detailId) === String($(this).attr('data-detail-id'))) || {};

            if (isNaN(val) || val < 0) bad = `Escribe cuánto salió de «${p.nombre}» (0 si nada).`;
            else if (!p.decimals && Math.floor(val) !== val) bad = `«${p.nombre}» se cuenta en ${p.unidad}: sin decimales.`;

            quantities[$(this).attr('data-detail-id')] = isNaN(val) || val < 0 ? 0 : val;
        });

        if (bad) return this.alertBox({ type: 'warning', title: bad });

        this.alertBox({
            type:        'confirm',
            title:       `Confirmar producción ${e.folio || ''}`.trim(),
            detailHtml:  'Se sumará al almacén la cantidad que realmente salió y la entrada pasará a Aplicada.',
            okLabel:     'Sí, confirmar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiEntradas, data: { opc: 'confirmEntrada', id: e.id, quantities: JSON.stringify(quantities) } }).catch(() => null);

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Producción confirmada', timer: 1800 });
                    entradas.lsEntradas();
                    entradas.lsKpis();
                    entradas.getEntrada(e.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo confirmar la producción' });
                }
            }
        });
    }

    renderInfoCards(rows) {
        this.invKpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => entradas.lsKpiDetail(kpi)
        });
    }

    renderHeader(data) {
        this.viewHeader({ parent: 'viewHeader', json: data });
    }

    // -- Nueva entrada --

    // Antes de la captura se eligen Tipo de entrada, Sucursal, Almacén y Fecha.
    // El ctrl los revisa (verifyNuevaEntrada) y la captura abre con ellos.
    openNuevaEntrada() {
        const hoy = moment().format('YYYY-MM-DD');

        this.createModalForm({
            id:           'formNuevaEntrada',
            data:         { opc: 'verifyNuevaEntrada' },
            theme:        'light',
            coffeesoft:   true,
            prefijo:      'ne_',
            closeOnError: false,
            bootbox: {
                title:       'Nueva entrada',
                size:        'small',
                closeButton: true
            },
            json: this.jsonNuevaEntrada(app.subId, hoy),
            success: (response) => {
                if (response && response.status === 200) {
                    this.openEntradaForm(response.data);
                } else {
                    this.alertBox({ type: 'warning', title: (response && response.message) || 'No se pudo abrir la entrada' });
                }
            }
        });

        $('#ne_date_inflow').attr('max', hoy);
        this.mountNuevaEntradaIconos();
        this.mountNuevaEntradaProveedor();
        this.syncNuevaEntradaTipo();
    }

    captureOrigins() {
        return (app.dataInit.origenes || []).filter((o) => o.capture);
    }

    jsonNuevaEntrada(curSub, hoy) {
        return [
            {
                opc:      'select',
                id:       'inflow_origin_id',
                lbl:      'Tipo de entrada',
                class:    'col-12',
                data:     this.captureOrigins(),
                onchange: 'entradasView.syncNuevaEntradaTipo()',
                required: true
            },
            {
                opc:   'select',
                id:    'supplier_id',
                lbl:   'Proveedor',
                class: 'col-12 hidden',
                data:  [{ id: '', valor: '-- Selecciona proveedor --' }].concat(app.dataInit.proveedores || [])
            },
            {
                opc:      'select',
                id:       'branch_id',
                lbl:      'Sucursal destino',
                class:    'col-12',
                value:    curSub,
                data:     app.dataInit.sucursales || [],
                required: true
            },
            {
                opc:      'select',
                id:       'warehouse_id',
                lbl:      'Almacén',
                class:    'col-12',
                data:     this.almacenesDe(curSub),
                required: true
            },
            {
                opc:      'input',
                type:     'date',
                id:       'date_inflow',
                lbl:      'Fecha',
                class:    'col-12',
                value:    hoy,
                required: true
            }
        ];
    }

    // -- Proveedor nuevo (formulario previo) --
    // El mismo modal y el mismo createSupplier de la captura (EntradaForm.openNuevoProveedor).

    mountNuevaEntradaProveedor() {
        if (!can('agregar')) return;

        const $campo = $('#ne_supplier_id').closest('.relative').parent();

        $campo.find('label').first().before(
            $('<button>', {
                type:  'button',
                id:    'ne_btnNuevoProveedor',
                class: 'float-right text-[10px] font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center leading-none mt-1'
            }).append(
                $('<i>', { 'data-lucide': 'plus', class: 'w-3 h-3 mr-0.5' }),
                document.createTextNode('Nuevo')
            ).on('click', () => this.openNuevaEntradaProveedor())
        );

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    openNuevaEntradaProveedor() {
        const form = this.entradaFormInstance();

        form.openNuevoProveedor({
            z: 'z-[2000]',
            onCreated: (sup) => {
                form.addSupplierOption(sup);

                const lista = app.dataInit.proveedores || (app.dataInit.proveedores = []);
                if (!lista.some((p) => String(p.id) === String(sup.id))) lista.push({ id: sup.id, valor: sup.valor });

                const $sel = $('#ne_supplier_id');
                if (!$sel.find(`option[value="${sup.id}"]`).length) $sel.append($('<option>', { value: sup.id, text: sup.valor }));
                $sel.val(String(sup.id));
            }
        });
    }

    // Íconos dentro de los selects y, debajo del Tipo, su descripción.
    mountNuevaEntradaIconos() {
        const iconos = {
            ne_inflow_origin_id: 'log-in',
            ne_branch_id:        'building-2',
            ne_warehouse_id:     'warehouse',
            ne_supplier_id:      'truck'
        };

        $.each(iconos, (id, icon) => {
            $('#' + id).addClass('!pl-10').before(
                $('<span>', { id: id + '_ico', class: 'pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center' })
                    .append($('<i>', { 'data-lucide': icon, class: 'w-4 h-4' }))
            );
        });

        $('#ne_inflow_origin_id').closest('.relative').parent().append(
            $('<div>', {
                id:    'ne_inflow_origin_hint',
                class: 'mt-1.5 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[11px] leading-snug text-gray-600'
            }).append(
                $('<i>', { 'data-lucide': 'info', class: 'w-3.5 h-3.5 mt-px flex-shrink-0 text-blue-600' }),
                $('<span>', { id: 'ne_inflow_origin_hint_text' })
            )
        );

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Lo que explica el tipo elegido; el proveedor solo si el tipo lo pide.
    syncNuevaEntradaTipo() {
        const id   = String($('#ne_inflow_origin_id').val());
        const tipo = (app.dataInit.origenes || []).find((o) => String(o.id) === id);
        const desc = (tipo && tipo.description) || '';
        const hint = tipo && Number(tipo.starts_pending) ? ' Nace pendiente: suma al almacén cuando se confirme.' : '';

        $('#ne_inflow_origin_id_ico').html($('<i>', { 'data-lucide': (tipo && tipo.icon) || 'log-in', class: 'w-4 h-4' }));
        if (typeof lucide !== 'undefined') lucide.createIcons();

        $('#ne_inflow_origin_hint_text').text((desc + hint).trim());
        $('#ne_inflow_origin_hint').toggleClass('hidden', !(desc + hint).trim());

        const exige = !!(tipo && Number(tipo.requires_supplier));
        $('#ne_supplier_id').closest('.relative').parent().toggleClass('hidden', !exige);
        if (!exige) $('#ne_supplier_id').val('');
    }

    // Almacenes activos de la sucursal.
    almacenesDe(branchId) {
        const almacenes = (app.dataInit.almacenes || []).filter((a) => String(a.branch_id) === String(branchId));
        return almacenes.length ? almacenes : [{ id: '', valor: 'Sin almacenes activos' }];
    }

    // `prefill` = lo que eligió el formulario previo (origen, branch_id, warehouse_id, fecha).
    openEntradaForm(prefill = null) {
        const form = this.entradaFormInstance();
        form.setData(Object.assign({ branch_id: app.subId, fecha: moment().format('YYYY-MM-DD') }, prefill || {}));
        form.open();
    }

    // -- Editar (la captura abierta con sus datos; contraseña primero) --

    async openEditEntrada(id) {
        const r = await useFetch({ url: apiEntradas, data: { opc: 'getEntrada', id } });

        if (!(r && r.status === 200)) return this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo abrir la entrada' });

        const h = r.header || {};

        // Con un conteo aplicado en el almacén no se edita lo anterior a su fecha (el ctrl también lo revisa).
        if (h.adjustment_date && h.operation_date && h.operation_date < h.adjustment_date) {
            return this.alertBox({
                type:       'warning',
                title:      'Entrada bloqueada',
                detailHtml: `El almacén tuvo un conteo aplicado el ${moment(h.adjustment_date).format('DD/MM/YYYY')}. Una entrada del ${moment(h.operation_date).format('DD/MM/YYYY')} ya no se edita.`
            });
        }

        const ok = await this.invAskPassword({ url: apiEntradas, doc: 'inflow-edit', id, hint: 'Para editar una entrada ya registrada escribe tu contraseña.' });
        if (!ok) return;

        const catalogo = app.dataInit.productos || [];

        // Aplicada, lo que ya sumó al almacén está dentro del stock: la captura lo resta
        // para que «Antes → Quedó» enseñe el efecto de la entrada como quedará.
        this.editBase = h.status === 'Aplicada' ? { warehouse_id: String(h.warehouse_id), qty: {} } : null;
        if (this.editBase) (r.detail || []).forEach((d) => {
            this.editBase.qty[String(d.product_id)] = (this.editBase.qty[String(d.product_id)] || 0) + Number(d.quantity || 0);
        });

        this.entradaFormInstance().openEdit({
            id:                h.id,
            folio:             h.folio,
            origen:            h.inflow_origin_id,
            branch_id:         h.branch_id,
            warehouse_id:      h.warehouse_id,
            warehouse_area_id: h.warehouse_area_id,
            supplier_id:       h.supplier_id,
            fecha:             String(h.operation_date || '').slice(0, 10),
            nota:              h.note || '',
            factura:           h.invoice_folio || '',
            productos: (r.detail || []).map((d) => {
                const prod = catalogo.find((p) => String(p.id) === String(d.product_id)) || {};

                return Object.assign({}, prod, {
                    id:          String(d.product_id),
                    nombre:      d.product_name,
                    sku:         d.sku || '',
                    categoria:   prod.categoria || 'Sin categoria',
                    cantidad:    Number(d.quantity),
                    costo:       Number(d.cost || 0),
                    costoSinTax: Number(d.tax) > 0 ? Number(d.cost || 0) / (1 + Number(d.tax) / 100) : Number(d.cost || 0),
                    tax:         Number(d.tax || 0),
                    stock:       0,
                    image:       d.image || ''
                });
            })
        });
    }

    async updateEntrada(payload) {
        const send = () => useFetch({ url: apiEntradas, data: { opc: 'updateEntrada', payload: JSON.stringify(this.buildEntradaPayload(payload)) } });
        let r = await send();

        // 403 = venció la autorización (10 min desde la contraseña): se pide otra vez.
        if (r && r.status === 403) {
            const ok = await this.invAskPassword({ url: apiEntradas, doc: 'inflow-edit', id: payload.id, hint: 'Vuelve a escribir tu contraseña para guardar los cambios.' });
            if (!ok) return;
            r = await send();
        }

        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message || 'Entrada actualizada', timer: 1600 });
            entradas.lsEntradas();
            entradas.lsKpis();
            entradas.getEntrada(payload.id);
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo actualizar la entrada' });
        }
    }

    buildEntradaPayload(payload) {
        return {
            id:                payload.id || null,
            note:              payload.nota || null,
            invoice_folio:     payload.factura || null,
            date_inflow:       payload.fecha,
            inflow_origin_id:  payload.origen,
            warehouse_id:      payload.warehouseId,
            warehouse_area_id: payload.warehouseAreaId || null,
            branch_id:         payload.sucursalId,
            supplier_id:       payload.supplierId || null,
            voucher_b64:       payload.voucher || null,
            productos:         payload.productos.map((p) => ({
                product_id:        p.id,
                quantity:          p.cant,
                price_without_tax: p.priceWithoutTax,
                tax:               p.tax,
                cost:              p.costo
            }))
        };
    }

    entradaFormInstance() {
        if (this.entradaFormApi) return this.entradaFormApi;

        this.entradaFormApi = this.entradaForm({
            parent: 'body',
            id:     'entradaFormModal',
            json:   app.dataInit.productos || [],
            labels: { subtitle: 'Productos del Catálogo con inventario', almacen: 'Almacén', destino: 'Área' },
            data: {
                origenes:    this.captureOrigins(),
                sucursales:  app.dataInit.sucursales || [],
                almacenes:   app.dataInit.almacenes  || [],
                areas:       app.dataInit.areas      || [],
                categorias:  app.dataInit.categorias || [],
                unidades:    app.dataInit.unidades   || [],
                proveedores: app.dataInit.proveedores || [],
                ajustes:     app.dataInit.ajustes || {},
                fecha:       moment().format('YYYY-MM-DD'),
                branch_id:   app.subId
            },
            onUpdate: (payload) => this.updateEntrada(payload),
            onWarehouseChange: async (warehouseId, done) => {
                if (!warehouseId) { done({}); return; }

                const r     = await useFetch({ url: apiEntradas, data: { opc: 'lsStockByWarehouse', warehouse_id: warehouseId } });
                const stock = Object.assign({}, (r && r.status === 200) ? (r.stock || {}) : {});
                const base  = this.entradaFormApi && this.entradaFormApi.editing ? this.editBase : null;

                if (base && base.warehouse_id === String(warehouseId)) {
                    Object.keys(base.qty).forEach((pid) => { stock[pid] = Number(stock[pid] || 0) - base.qty[pid]; });
                }

                done(stock);
            },
            onCreateSupplier: can('agregar') ? async (data, done) => {
                const r = await useFetch({ url: apiEntradas, data: Object.assign({ opc: 'createSupplier' }, data) });

                if (r && r.status === 200 && r.id) {
                    this.alertBox({ type: 'success', title: r.message || 'Proveedor creado', timer: 1600 });
                    done({ id: r.id, valor: r.valor });
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo crear el proveedor' });
                }
            } : null,
            onAdd: async (payload) => {
                const r = await useFetch({ url: apiEntradas, data: { opc: 'saveEntrada', payload: JSON.stringify(this.buildEntradaPayload(payload)) } });

                if (r && r.status === 200) {
                    this.alertBox({ type: r.pending ? 'message' : 'success', title: r.message || ('Entrada ' + r.folio + ' registrada'), timer: r.pending ? 0 : 1600 });

                    // Se recarga la lista y se abre el visor con la entrada recién creada.
                    const lista = entradas.lsEntradas();
                    entradas.lsKpis();
                    await lista;
                    if (r.folio && r.id) app.selectEntrada(r.folio, r.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo registrar la entrada' });
                }
            },
            onLoadFormatos: async () => {
                const r = await useFetch({ url: apiEntradas, data: { opc: 'lsFormatos' } });
                return (r && r.status === 200) ? (r.formatos || []) : [];
            },
            onSaveFormato: async (data) => {
                const r = await useFetch({
                    url:  apiEntradas,
                    data: {
                        opc:       'saveFormato',
                        name:      data.name,
                        scope:     data.scope,
                        productos: JSON.stringify((data.productos || []).map((p) => ({ id: p.id, cantidad: p.cantidad })))
                    }
                });

                if (r && r.status === 200) {
                    if (!data.silent) this.alertBox({ type: 'success', title: r.message || 'Formato guardado', timer: 1600 });
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar el formato' });
                }
            },
            onDeleteFormato: async (id) => {
                const r = await useFetch({ url: apiEntradas, data: { opc: 'deleteFormato', id } });

                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Formato eliminado', timer: 1600 });
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo eliminar el formato' });
                }
            }
        });

        return this.entradaFormApi;
    }

    // -- Visor de la derecha (el de inventory) --
    // Pendiente y con permiso de confirmar: la cantidad es un campo (lo que de verdad salió).
    // Sin «ver costos» no hay columnas de precio ni total en pesos.

    entradaDetailPanel(options) {
        const defaults = {
            parent:  'root',
            id:      'entradaDetailPanel',
            json:    null,
            costs:   true,
            labels: {
                emptyTitle:    'Selecciona una entrada',
                emptyHint:     'Haz click en el folio o en el ícono del ojo para ver el detalle aquí.',
                subtitleLbl:   'Detalle de recepción',
                reversar:      'Cancelar',
                confirmar:     'Confirmar producción',
                comprobante:   'Comprobante',
                subirComp:     'Subir',
                arrastrarComp: 'También puedes arrastrar la foto o PDF al panel',
                soltarComp:    'Suelta el archivo para cargarlo como comprobante',
                sinComp:       'Sin comprobante'
            },
            estadoPalettes: {
                'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Pendiente': { bg: 'rgba(251,191,36,0.15)', fg: '#D97706' },
                'Cancelada': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            actions:         { cancel: true, confirm: true, voucher: true, print: true },
            onClose:         () => {},
            onPrint:         () => {},
            onReverse:       () => {},
            onEdit:          () => {},
            onConfirm:       () => {},
            onUploadVoucher: () => {},
            onRemoveVoucher: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels  = Object.assign({}, defaults.labels,  o.labels  || {});
        opts.actions = Object.assign({}, defaults.actions, o.actions || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        // El panel se repinta en cada selección: se sueltan los handlers de arrastre anteriores.
        $parent.off('.voucher');

        const esc      = invEsc;
        const fmtMoney = invMoney;

        if (!opts.json) {
            $parent.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                    <i data-lucide="inbox" class="w-10 h-10 text-gray-300 mb-3"></i>
                    <p class="text-sm font-semibold text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-xs text-gray-400 mt-1 max-w-[200px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e           = opts.json;
        const isCancelled = e.estado === 'Cancelada';
        const isPending   = e.estado === 'Pendiente';
        const editQty     = isPending && opts.actions.confirm;
        const costs       = !!opts.costs;
        const eP          = opts.estadoPalettes[e.estado] || { bg: 'rgba(156,163,175,0.15)', fg: '#9CA3AF' };
        const fmtUds      = (n) => (n % 1 === 0) ? String(n) : Number(n).toFixed(2);

        const productosHtml = (e.productos || []).map((p) => {
            const subtotal = Number(p.cant || 0) * Number(p.costo || 0);
            const qty      = editQty
                ? `<input type="number" class="entrada-real-qty w-16 text-center text-xs bg-white border border-gray-300 rounded px-1 py-0.5 text-gray-800" data-detail-id="${p.detailId}" value="${p.cant}" min="0" step="${p.decimals ? '0.01' : '1'}">`
                : `<span class="font-semibold ${isPending ? 'text-amber-500' : 'text-gray-800'}">${invQty(p.cant)}</span>`;
            const lote     = p.lote || p.caduca
                ? `<p class="text-[10px] text-gray-400 leading-tight mt-0.5">${p.lote ? 'Lote ' + esc(p.lote) : ''}${p.lote && p.caduca ? ' · ' : ''}${p.caduca ? 'Caduca ' + esc(moment(p.caduca).format('DD/MM/YYYY')) : ''}</p>`
                : '';

            return `
                <tr class="border-b border-gray-100 last:border-b-0 align-top">
                    <td class="!py-1 !pl-2 !pr-2">
                        <p class="text-[11px] font-medium text-gray-700 leading-tight">${esc(p.nombre)}${p.sku ? ` <span class="text-[10px] font-normal text-gray-400">${esc(p.sku)}</span>` : ''}</p>
                        ${lote}
                    </td>
                    ${costs ? `<td class="!py-1 !px-1 text-right text-[11px] text-gray-500 whitespace-nowrap">${fmtMoney(p.costo)}</td>` : ''}
                    <td class="!py-1 !px-1 text-center text-[11px]">${qty}</td>
                    ${costs ? `<td class="!py-1 !px-1 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap" id="${opts.id}_sub_${p.detailId}">${fmtMoney(subtotal)}</td>` : ''}
                    <td class="!py-1 !pl-1 !pr-2 text-center text-[11px] text-gray-500">${esc(p.unidad || '-')}</td>
                </tr>
            `;
        }).join('');

        // Comprobante: miniatura (o "PDF") que abre el archivo; subir, cambiar o quitar
        // mientras la entrada no esté cancelada, si el rol puede.
        const voucherEditable = !isCancelled && opts.actions.voucher;
        const voucherHtml     = (() => {
            const input = voucherEditable ? `<input type="file" id="${opts.id}_voucherInput" accept="image/*,application/pdf" class="hidden">` : '';
            const btn   = 'w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors';

            if (!e.comprobante) {
                return voucherEditable
                    ? `${input}<button type="button" id="${opts.id}_voucherUpload" class="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 transition-colors" title="${esc(opts.labels.arrastrarComp)}"><i data-lucide="upload" class="w-3 h-3"></i>${esc(opts.labels.subirComp)}</button>`
                    : `<span class="text-gray-400">${esc(opts.labels.sinComp)}</span>`;
            }

            const isPdf = /\.pdf(\?|$)/i.test(e.comprobante);
            const view  = isPdf
                ? `<a href="${esc(e.comprobante)}" target="_blank" rel="noopener" class="flex items-center gap-1 text-gray-700 hover:text-blue-600"><i data-lucide="file-text" class="w-3.5 h-3.5"></i>PDF</a>`
                : `<a href="${esc(e.comprobante)}" target="_blank" rel="noopener"><img src="${esc(e.comprobante)}" alt="${esc(opts.labels.comprobante)}" class="w-8 h-8 rounded object-cover border border-gray-200"></a>`;
            const edit  = voucherEditable
                ? `<button type="button" id="${opts.id}_voucherUpload" class="${btn} hover:text-blue-600" title="Cambiar"><i data-lucide="refresh-cw" class="w-3 h-3"></i></button>
                   <button type="button" id="${opts.id}_voucherRemove" class="${btn} hover:text-red-500" title="Quitar"><i data-lucide="trash-2" class="w-3 h-3"></i></button>`
                : '';

            return `${input}<span class="flex items-center gap-1">${view}${edit}</span>`;
        })();

        const totUds   = (e.productos || []).reduce((s, p) => s + Number(p.cant || 0), 0);
        const totCosto = (e.productos || []).reduce((s, p) => s + Number(p.cant || 0) * Number(p.costo || 0), 0);
        const showBar  = !isCancelled && ((isPending && opts.actions.confirm) || opts.actions.cancel || opts.actions.edit);
        const row      = (label, html, wide = false) => `<div class="flex items-${wide ? 'start' : 'center'} justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(label)}</span><span class="text-gray-700 text-right">${html}</span></div>`;

        $parent.html(`
            <div class="relative flex-1 flex flex-col overflow-hidden">
                ${voucherEditable ? `
                <div id="${opts.id}_drop" class="hidden absolute inset-2 z-20 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/90 flex-col items-center justify-center gap-2 text-center px-6 pointer-events-none">
                    <i data-lucide="paperclip" class="w-7 h-7 text-blue-600"></i>
                    <p class="text-xs font-semibold text-blue-700">${esc(opts.labels.soltarComp)}</p>
                </div>` : ''}
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 dark:!border-0 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitleLbl)}</p>
                        <p class="text-base font-bold text-gray-800">${esc(e.folio || '-')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-xs font-bold" style="background:${eP.bg};color:${eP.fg};">${esc(e.estado || '')}</span>
                        ${opts.actions.print ? `
                        <button id="${opts.id}_print" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="Imprimir">
                            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                        </button>` : ''}
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="Cerrar">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <div class="px-4 py-3 border-b border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                    ${row('Tipo de entrada', e.origenBadge || esc(e.origen || '-'))}
                    ${row('Sucursal', esc(e.sucursal || '-'))}
                    ${row('Almacén', esc(e.almacen || '-') + (e.destino ? ` <span class="text-gray-400">/ ${esc(e.destino)}</span>` : ''))}
                    ${e.proveedor ? row('Proveedor', esc(e.proveedor)) : ''}
                    ${e.factura ? row('Folio factura', esc(e.factura)) : ''}
                </div>

                <div class="flex-1 overflow-y-auto px-4 py-2">
                    <p class="text-xs uppercase tracking-wider text-gray-500 mb-1">Productos (${(e.productos || []).length})</p>
                    ${editQty ? '<p class="text-[11px] text-amber-600 mb-1.5">Escribe cuánto salió de verdad de cada producto y confirma.</p>' : ''}
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
                            <tbody>${productosHtml}</tbody>
                        </table>
                    </div>
                </div>

                <div class="cs-visor-totals px-4 py-2.5 border-t border-gray-200 dark:!border-0 bg-gray-50 flex-shrink-0">
                    <div class="flex items-center justify-between ${costs ? 'text-xs text-gray-500 mb-1' : ''}">
                        <span class="${costs ? '' : 'text-sm font-semibold text-gray-700'}">Unidades</span>
                        <span class="${costs ? 'font-semibold text-gray-700' : 'text-lg font-bold text-gray-800'}" id="${opts.id}_totUds">${fmtUds(totUds)}</span>
                    </div>
                    ${costs ? `
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-700">Total general</span>
                        <span class="text-lg font-bold text-gray-800" id="${opts.id}_totCosto">${fmtMoney(totCosto)}</span>
                    </div>` : ''}
                </div>

                <div class="px-4 py-2.5 border-t border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                    ${row('Registrado', esc(e.registrado || '-'))}
                    ${e.confirmadoPor ? row('Confirmado', esc(e.confirmadoPor)) : ''}
                    ${e.editadoPor ? row('Editado', esc(e.editadoPor)) : ''}
                    ${e.canceladoPor ? row('Cancelado', esc(e.canceladoPor)) : ''}
                    ${e.motivo ? row('Motivo', esc(e.motivo), true) : ''}
                    ${e.nota ? row('Nota', esc(e.nota), true) : ''}
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(opts.labels.comprobante)}</span>${voucherHtml}</div>
                </div>

                ${showBar ? `
                <div class="px-4 py-3 border-t border-gray-200 dark:!border-0 flex gap-2 flex-shrink-0">
                    ${isPending && opts.actions.confirm ? `
                        <button id="${opts.id}_confirm" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-green-600 hover:bg-green-500 flex items-center justify-center gap-1.5">
                            <i data-lucide="check" class="w-3.5 h-3.5"></i>${esc(opts.labels.confirmar)}
                        </button>` : ''}
                    ${opts.actions.edit ? `
                        <button id="${opts.id}_edit" class="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg border-[1px] border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center gap-1.5">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar
                        </button>` : ''}
                    ${opts.actions.cancel ? `
                        <button id="${opts.id}_reverse" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5">
                            <i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.reversar)}
                        </button>` : ''}
                </div>` : ''}
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $parent.find(`#${opts.id}_close`).on('click',   () => opts.onClose(e));
        $parent.find(`#${opts.id}_print`).on('click',   () => opts.onPrint(e));
        $parent.find(`#${opts.id}_reverse`).on('click', () => opts.onReverse(e));
        $parent.find(`#${opts.id}_edit`).on('click',    () => opts.onEdit(e));
        $parent.find(`#${opts.id}_confirm`).on('click', () => opts.onConfirm(e));

        const $voucherInput = $parent.find(`#${opts.id}_voucherInput`);
        $parent.find(`#${opts.id}_voucherUpload`).on('click', () => $voucherInput.trigger('click'));
        $parent.find(`#${opts.id}_voucherRemove`).on('click', () => opts.onRemoveVoucher(e));
        $voucherInput.on('change', (ev) => {
            const file = ev.target.files && ev.target.files[0];
            if (file) opts.onUploadVoucher(e, file);
        });

        // Un archivo soltado en cualquier parte del panel es el comprobante.
        $parent.on('dragover.voucher drop.voucher', (ev) => ev.preventDefault());

        if (voucherEditable) {
            const $drop    = $parent.find(`#${opts.id}_drop`);
            const hasFiles = (ev) => Array.from((ev.originalEvent.dataTransfer || {}).types || []).includes('Files');
            let depth = 0;

            $parent.on('dragenter.voucher', (ev) => {
                if (!hasFiles(ev)) return;
                depth++;
                $drop.removeClass('hidden').addClass('flex');
            });
            $parent.on('dragleave.voucher', (ev) => {
                if (!hasFiles(ev)) return;
                depth = Math.max(0, depth - 1);
                if (!depth) $drop.removeClass('flex').addClass('hidden');
            });
            $parent.on('drop.voucher', (ev) => {
                depth = 0;
                $drop.removeClass('flex').addClass('hidden');
                const files = ev.originalEvent.dataTransfer && ev.originalEvent.dataTransfer.files;
                if (files && files[0]) opts.onUploadVoucher(e, files[0]);
            });
        }

        // Al escribir lo que salió, el total sigue en vivo.
        if (editQty) {
            const costMap = {};
            (e.productos || []).forEach((p) => { costMap[String(p.detailId)] = Number(p.costo || 0); });

            $parent.find('.entrada-real-qty').on('input', () => {
                let uds = 0;
                let costo = 0;

                $parent.find('.entrada-real-qty').each(function () {
                    const did = $(this).attr('data-detail-id');
                    const v   = parseFloat($(this).val());
                    const q   = isNaN(v) || v < 0 ? 0 : v;
                    const sub = q * (costMap[did] || 0);

                    uds   += q;
                    costo += sub;
                    $parent.find(`#${opts.id}_sub_${did}`).text(fmtMoney(sub));
                });

                $parent.find(`#${opts.id}_totUds`).text(fmtUds(uds));
                $parent.find(`#${opts.id}_totCosto`).text(fmtMoney(costo));
            });
        }
    }
}
