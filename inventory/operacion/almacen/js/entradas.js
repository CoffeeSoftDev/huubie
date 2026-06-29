let apiEntradas = 'ctrl/ctrl-entradas.php';
let app, entradas, entradasView;

let branch_id;

const VIEW_HEADER_ENTRADAS = {
    title:    'Entradas de Inventario',
    subtitle: 'Recepciones de produccion, compras y transferencias por sucursal'
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
    }

    async init() {
        const r = await useFetch({ url: apiEntradas, data: { opc: 'init' } });
        if (r && r.status === 200) {
            this.dataInit = {
                branch_id: r.branch_id || '',
                sucursales:      r.sucursales        || [],
                origenes:        r.origenes_entrada  || [],
                estados:         r.estados_entrada   || [],
                almacenes:       r.almacenes         || [],
                proveedores:     r.proveedores       || [],
                productos:       r.productos         || []
            };
        } else {
            this.dataInit = {
                branch_id: '',
                sucursales:      [],
                origenes:        [],
                estados:         [],
                almacenes:       [],
                proveedores:     [],
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
        entradasView.renderDetail(null);
        this.populateFilters();
        this.updateHeaderTitle();
        entradas.lsEntradas();
        entradas.lsKpis();
    }

    updateHeaderTitle() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const $branch    = $('#branch_id');
        const branchVal  = $branch.length ? ($branch.val() || '') : '';
        const branch     = (this.dataInit.sucursales || []).find(s => String(s.id) === String(branchVal));
        const branchName = branch ? (branch.valor || '') : '';

        const titleHtml = branchName
            ? `${VIEW_HEADER_ENTRADAS.title} <span class="font-bold" style="color:#C05A40;">&middot; ${esc(branchName)}</span>`
            : VIEW_HEADER_ENTRADAS.title;

        entradasView.renderHeader(Object.assign({}, VIEW_HEADER_ENTRADAS, { titleHtml }));
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
        let filters = [
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
                opc:      'select',
                id:       'branch_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                data:     [{ id: '', valor: '-- Todas --' }]
            },
            {
                opc:      'select',
                id:       'fOrigen',
                lbl:      'Origen:',
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
            },
            {
                opc:       'button',
                id:        'btnNuevaEntrada',
                text:      'Agregar Entrada',
                color_btn: 'invernal',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => entradasView.openEntradaForm()
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
        }
        // Arrancamos en la sucursal activa del usuario. Si solo tiene una, el
        // select queda fijo (sin opcion "Todas" y deshabilitado).
        if (sucursales.length <= 1) {
            $('#branch_id').find('option[value=""]').remove();
            $('#branch_id').val(this.subId).prop('disabled', true);
        } else {
            $('#branch_id').val(this.subId);
        }
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
            // Respetamos el select aunque valga '' (-- Todas --); solo caemos a la
            // sucursal del usuario si el select aun no existe en el DOM.
            branch_id: $branch.length ? ($branch.val() || '') : (this.subId || ''),
            origen:          $('#fOrigen').val()        || '',
            estado:          $('#fEstado').val()        || '',
            fi:              this.rangeFi               || '',
            ff:              this.rangeFf               || '',
            q:               $('#qBuscar').val()        || ''
        };
    }

    async onChangeFilters() {
        this.updateHeaderTitle();
        entradas.lsEntradas();
        await entradas.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectEntrada(null);
        }
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    selectEntrada(folio, id) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
            entradas.getEntrada(id);
        } else {
            entradasView.renderDetail(null);
        }
    }
}

class Entradas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'entradas';
    }

    async lsEntradas() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiEntradas,
            data: Object.assign({ opc: 'lsEntradas' }, {
                branch_id: f.branch_id,
                origin_id:       f.origen,
                status:          f.estado,
                fi:              f.fi,
                ff:              f.ff,
                q:               f.q
            })
        });

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 7, 9],
            right:        [8],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       13,
            emptyMessage: 'No se encontraron entradas con los filtros aplicados',
            emptyIcon:    'icon-arrow-down-to-line',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }
        app.updateFooterInfo(`Mostrando ${total} entrada${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiEntradas,
            data: {
                opc:             'showEntradas',
                branch_id: f.branch_id,
                origin_id:       f.origen,
                status:          f.estado,
                fi:              f.fi,
                ff:              f.ff,
                q:               f.q
            }
        });

        const c   = (r && r.status === 200) ? r.counts : {};
        const costo = Number(c.total_costo || 0);

        const kpis = [
            { id: 'kpiEntradas',  label: 'Entradas',    value: parseInt(c.total_entradas  || 0, 10), tone: 'success' },
            { id: 'kpiCosto',     label: 'Costo Total', value: '$' + costo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), tone: 'default' },
            { id: 'kpiUnidades',  label: 'Unidades',    value: parseInt(c.total_unidades  || 0, 10), tone: 'warning' },
            { id: 'kpiAplicadas', label: 'Aplicadas',   value: parseInt(c.total_aplicadas || 0, 10), tone: 'purple'  }
        ];
        entradasView.renderInfoCards(kpis);
    }

    async getEntrada(id) {
        const r = await useFetch({ url: apiEntradas, data: { opc: 'getEntrada', id: id } });
        if (r && r.status === 200) {
            entradasView.renderDetail(this.mapEntradaDetail(r.header || {}, r.detail || []));
        } else {
            entradasView.renderDetail(null);
        }
    }

    mapEntradaDetail(h, detail) {
        const raw     = String(h.date_inflow || '');
        const iso     = raw.length <= 10 ? (raw ? raw + 'T00:00:00' : '') : raw.replace(' ', 'T');
        const confRaw = String(h.confirmed_at || '');
        return {
            id:            h.id,
            folio:         h.folio,
            fechaIso:      iso,
            estado:        h.status,
            origen:        h.origin_name,
            origenCode:    h.origin_code,
            origenBadge:   h.origin_badge || '',
            sucursal:      h.branch_name,
            almacen:       h.warehouse_name,
            proveedor:     h.supplier_name,
            registrado:    h.user_name,
            confirmadoPor: h.confirmed_user_name || '',
            confirmadoIso: confRaw ? confRaw.replace(' ', 'T') : '',
            nota:          h.note,
            productos: (detail || []).map(d => ({
                detailId:  d.id,
                nombre:    d.product_name,
                sku:       d.sku,
                cant:      Number(d.quantity || 0),
                cantReal:  d.confirmed_quantity != null ? Number(d.confirmed_quantity) : Number(d.quantity || 0),
                confirmada: d.confirmed_quantity != null,
                costo:     Number(d.cost || 0),
                stockPrev: Number(d.previous_stock || 0),
                image:     d.image || '',
                icon:      'package',
                bg:        'bg-gray-100',
                color:     'text-gray-500'
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
        this._renderEntradaDoc(e);
    }

    _renderEntradaDoc(e) {
        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const base = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
            if (d.getHours() === 0 && d.getMinutes() === 0) return base;
            let h = d.getHours();
            const min = String(d.getMinutes()).padStart(2,'0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${base} ${h}:${min} ${ampm}`;
        };

        const productos = e.productos || [];
        const qtyOf = (it) => it.cantReal != null ? Number(it.cantReal) : Number(it.cant || 0);
        const totals = productos.reduce((acc, it) => {
            const q = qtyOf(it);
            acc.uds   += q;
            acc.costo += q * Number(it.costo || 0);
            return acc;
        }, { uds: 0, costo: 0 });

        const rowsHtml = productos.map(it => {
            const q  = qtyOf(it);
            const cu = Number(it.costo || 0);
            return `<tr><td class="prod"><span class="prod-name">${esc(it.nombre)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td><td class="c">${esc(q)}</td><td class="r">${fmtMoney(cu)}</td><td class="r">${fmtMoney(q * cu)}</td></tr>`;
        }).join('');

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Entrada ${esc(e.folio||'')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800;color:#000}.folio{font-size:20px;font-weight:800;color:#000;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px;color:#000}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right;color:#000}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2;color:#000}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}.doc-footer{margin-top:28px;display:flex;justify-content:space-between;font-size:10px;color:#777;border-top:1px solid #ccc;padding-top:10px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Comprobante de Entrada</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(e.sucursal||'')}${e.almacen?' &middot; '+esc(e.almacen):''}</div></div><div><div class="folio">${esc(e.folio||'-')}</div>${e.estado?`<span class="status">${esc(e.estado)}</span>`:''}</div></div>
            <div class="info-grid"><div class="info-item"><span class="k">Origen</span><span class="v">${esc(e.origen||'-')}</span></div>${e.proveedor?`<div class="info-item"><span class="k">Proveedor</span><span class="v">${esc(e.proveedor)}</span></div>`:''}<div class="info-item"><span class="k">Fecha</span><span class="v">${esc(fmtFecha(e.fechaIso))}</span></div><div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(e.sucursal||'-')}</span></div><div class="info-item"><span class="k">Almacen</span><span class="v">${esc(e.almacen||'-')}</span></div><div class="info-item"><span class="k">Registrado por</span><span class="v">${esc(e.registrado||'-')}</span></div></div>
            <table><thead><tr><th>Producto</th><th class="c">Cant</th><th class="r">Costo unit.</th><th class="r">Subtotal</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="4" class="c">Sin productos</td></tr>'}</tbody></table>
            <div class="totals"><div class="totals-box"><div class="totals-row"><span>Tipos de producto</span><span>${productos.length}</span></div><div class="totals-row"><span>Unidades</span><span>${totals.uds}</span></div><div class="totals-row grand"><span>Costo total</span><span>${fmtMoney(totals.costo)}</span></div></div></div>
            ${e.nota?`<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;color:#222"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(e.nota)}</div>`:''}
            <div class="doc-footer"><span>Huubie &middot; Inventarios &middot; Comprobante de entrada</span><span>Generado: ${esc(fmtFecha(new Date().toISOString()))}</span></div>
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) { this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' }); return; }
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

    renderDetail(entrada, editMode = false) {
        this.entradaDetailPanel({
            parent:       'detailPanel',
            json:         entrada,
            editMode:     editMode,
            onClose:      () => app.selectEntrada(null),
            onPrint:      (e) => { if (e) entradas.printEntrada(e); },
            onReverse:    (e) => this.cancelEntrada(e),
            onConfirm:    (e) => this.confirmEntrada(e),
            onEdit:       (e) => this.renderDetail(e, true),
            onCancelEdit: (e) => this.renderDetail(e, false),
            onSaveEdit:   (e) => this.saveEntradaEdit(e)
        });
    }

    saveEntradaEdit(e) {
        if (!e || !e.id) return;
        const quantities = {};
        $('#detailPanel .entrada-real-qty').each(function () {
            const did = $(this).attr('data-detail-id');
            const val = parseFloat($(this).val());
            quantities[did] = isNaN(val) || val < 0 ? 0 : val;
        });

        this.swalQuestion({
            opts: {
                title:             `Editar entrada ${e.folio || ''}`.trim(),
                text:              'Se ajustara el stock del almacen con las nuevas cantidades que entraron.',
                icon:              'question',
                confirmButtonText: 'Si, guardar',
                cancelButtonText:  'No'
            },
            data: { opc: 'editEntrada', id: e.id, quantities: JSON.stringify(quantities) },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        this.alertBox({ type: 'success', title: r.message || 'Entrada actualizada', timer: 1600 });
                        app.selectEntrada(e.folio, e.id);
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo actualizar la entrada' });
                    }
                }
            }
        });
    }

    cancelEntrada(e) {
        if (!e || !e.id) return;
        if (e.estado === 'Cancelada') {
            this.alertBox({ type: 'message', title: 'La entrada ya esta cancelada' });
            return;
        }
        this.swalQuestion({
            opts: {
                title:             `Cancelar entrada ${e.folio || ''}`.trim(),
                text:              'Se revertira el stock agregado y la entrada pasara a estado Cancelada.',
                icon:              'warning',
                confirmButtonText: 'Si, cancelar',
                cancelButtonText:  'No'
            },
            data: { opc: 'reverseEntrada', id: e.id },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        this.alertBox({ type: 'success', title: r.message || 'Entrada cancelada', timer: 1600 });
                        app.selectEntrada(null);
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar la entrada' });
                    }
                }
            }
        });
    }

    confirmEntrada(e) {
        if (!e || !e.id) return;
        if (e.estado !== 'Pendiente') {
            this.alertBox({ type: 'message', title: 'La entrada no esta pendiente de confirmar' });
            return;
        }
        const quantities = {};
        $('#detailPanel .entrada-real-qty').each(function () {
            const did = $(this).attr('data-detail-id');
            const val = parseFloat($(this).val());
            quantities[did] = isNaN(val) || val < 0 ? 0 : val;
        });

        this.swalQuestion({
            opts: {
                title:             `Confirmar produccion ${e.folio || ''}`.trim(),
                text:              'Se aplicara al almacen la cantidad que realmente entro y la entrada pasara a estado Aplicada.',
                icon:              'question',
                confirmButtonText: 'Si, confirmar',
                cancelButtonText:  'No'
            },
            data: { opc: 'confirmEntrada', id: e.id, quantities: JSON.stringify(quantities) },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        this.alertBox({ type: 'success', title: r.message || 'Produccion confirmada', timer: 1600 });
                        app.selectEntrada(null);
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo confirmar la produccion' });
                    }
                }
            }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => {}
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: () => {}
        });
    }

    openEntradaForm() {
        const curSub = $('#branch_id').val() || app.subId;
        if (!this.entradaFormApi) {
            this.entradaFormApi = this.entradaForm({
                parent: 'body',
                id:     'entradaFormModal',
                json:   app.dataInit.productos || [],
                data: {
                    origenes:        (app.dataInit.origenes    || []).filter(o => o.id !== ''),
                    sucursales:      (app.dataInit.sucursales  || []).filter(s => s.id !== ''),
                    almacenes:       app.dataInit.almacenes   || [],
                    proveedores:     app.dataInit.proveedores || [],
                    fecha:           moment().format('YYYY-MM-DD'),
                    branch_id: curSub
                },
                onCreateSupplier: async (data, done) => {
                    const r = await useFetch({
                        url:  apiEntradas,
                        data: Object.assign({ opc: 'createSupplier' }, data)
                    });
                    if (r && r.status === 200 && r.id) {
                        this.alertBox({ type: 'success', title: r.message || 'Proveedor creado', timer: 1600 });
                        done({ id: r.id, valor: r.valor });
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo crear el proveedor' });
                    }
                },
                onAdd: async (payload) => {
                    const backendPayload = {
                        note:             payload.nota || null,
                        date_inflow:      payload.fecha,
                        inflow_origin_id: payload.origen,
                        warehouse_id:     payload.warehouseId,
                        branch_id:  payload.sucursalId,
                        supplier_id:      payload.supplierId || null,
                        productos:        payload.productos.map(p => ({
                            product_id:        p.id,
                            quantity:          p.cant,
                            price_without_tax: p.priceWithoutTax,
                            tax:               p.tax,
                            cost:              p.costo
                        }))
                    };

                    const r = await useFetch({
                        url:  apiEntradas,
                        data: { opc: 'saveEntrada', payload: JSON.stringify(backendPayload) }
                    });

                    if (r && r.status === 200) {
                        this.alertBox({
                            type:  r.pending ? 'message' : 'success',
                            title: r.message || ('Entrada ' + r.folio + ' registrada'),
                            timer: r.pending ? 0 : 1600
                        });
                        entradas.lsEntradas();
                        entradas.lsKpis();
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
                            productos: JSON.stringify((data.productos || []).map(p => ({ id: p.id, cantidad: p.cantidad })))
                        }
                    });
                    if (r && r.status === 200) {
                        this.alertBox({ type: 'success', title: r.message || 'Formato guardado', timer: 1600 });
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar el formato' });
                    }
                },
                onDeleteFormato: async (id) => {
                    const r = await useFetch({ url: apiEntradas, data: { opc: 'deleteFormato', id: id } });
                    if (r && r.status === 200) {
                        this.alertBox({ type: 'success', title: r.message || 'Formato eliminado', timer: 1600 });
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo eliminar el formato' });
                    }
                },
                onClose: () => {}
            });
        }
        this.entradaFormApi.setData({ branch_id: curSub, fecha: moment().format('YYYY-MM-DD') });
        this.entradaFormApi.open();
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
            labelClass: 'text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1 text-left',
            valueClass: 'text-2xl font-bold text-right',
            onClick:    () => {}
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.tones = Object.assign({}, defaults.tones, (options || {}).tones || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`<p class="col-span-full text-xs text-gray-400 italic text-center py-2">Sin indicadores</p>`);
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
            json:    { title: '', titleHtml: '', subtitle: '' },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500'
            },
            onToggle: () => {}
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.json    = Object.assign({}, defaults.json,    (options || {}).json    || {});
        opts.classes = Object.assign({}, defaults.classes, (options || {}).classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    entradaDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'entradaDetailPanel',
            json:      null,
            labels: {
                emptyTitle:  'Selecciona una entrada',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de recepcion',
                imprimir:    'Imprimir',
                reversar:    'Cancelar',
                confirmar:   'Confirmar produccion',
                editar:      'Editar',
                guardar:     'Guardar cambios',
                cancelarEd:  'Cancelar'
            },
            origenPalettes: {
                'Produccion':    { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
                'Proveedor':     { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Transferencia': { bg: 'rgba(192,90,64,0.15)', fg: '#C05A40' },
                'Devolucion':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            estadoPalettes: {
                'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Pendiente': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Cancelada': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            editMode:     false,
            onClose:      () => {},
            onPrint:      () => {},
            onReverse:    () => {},
            onConfirm:    () => {},
            onEdit:       () => {},
            onSaveEdit:   () => {},
            onCancelEdit: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.origenPalettes = Object.assign({}, defaults.origenPalettes, o.origenPalettes || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

        const e         = opts.json;
        const isCancelled = e.estado === 'Cancelada';
        const isPending   = e.estado === 'Pendiente';
        const oP        = opts.origenPalettes[e.origen] || { bg: 'rgba(156,163,175,0.15)', fg: '#9CA3AF' };
        const eP        = opts.estadoPalettes[e.estado] || { bg: 'rgba(156,163,175,0.15)', fg: '#9CA3AF' };

        const productosHtml = (e.productos || []).map(p => {
            const cant = opts.editMode
                ? Number(p.cantReal || 0)
                : (p.confirmada ? Number(p.cantReal || 0) : Number(p.cant || 0));
            const subtotal = cant * Number(p.costo || 0);

            const qty = opts.editMode
                ? `<input type="number" class="entrada-real-qty w-16 text-center text-xs bg-white border border-gray-300 rounded px-1 py-0.5 text-gray-800" data-detail-id="${p.detailId}" value="${p.cantReal}" min="0" step="0.01">`
                : `<span class="font-semibold ${isPending ? 'text-amber-500' : 'text-gray-800'}">${p.confirmada ? p.cantReal : p.cant}</span>`;

            return `
                <tr class="border-b border-gray-100 align-top">
                    <td class="py-2 pr-2">
                        <p class="text-xs font-medium text-gray-700">${esc(p.nombre)}</p>
                        ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                    </td>
                    <td class="py-2 px-1 text-right text-xs text-gray-500 whitespace-nowrap">${fmtMoney(p.costo)}</td>
                    <td class="py-2 px-1 text-center text-xs">${qty}</td>
                    <td class="py-2 pl-1 text-right text-xs font-semibold text-gray-700 whitespace-nowrap" id="${opts.id}_sub_${p.detailId}">${fmtMoney(subtotal)}</td>
                </tr>
            `;
        }).join('');

        // Total general de la entrada: en edicion parte de las cantidades reales,
        // en lectura usa la cantidad confirmada si existe.
        const qtyOf  = (p) => opts.editMode
            ? Number(p.cantReal || 0)
            : (p.confirmada ? Number(p.cantReal || 0) : Number(p.cant || 0));
        const fmtUds = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
        const totUds   = (e.productos || []).reduce((s, p) => s + qtyOf(p), 0);
        const totCosto = (e.productos || []).reduce((s, p) => s + qtyOf(p) * Number(p.costo || 0), 0);

        $parent.html(`
            <div class="flex-1 flex flex-col overflow-hidden">
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitleLbl)}</p>
                        <p class="text-base font-bold text-gray-800">${esc(e.folio || '-')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-xs font-bold" style="background:${eP.bg};color:${eP.fg};">${esc(e.estado || '')}</span>
                        ${!opts.editMode ? `
                        <button id="${opts.id}_print" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="Imprimir">
                            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                        </button>` : ''}
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 space-y-1.5">
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 w-20 flex-shrink-0">Origen</span>
                        ${e.origenBadge ? e.origenBadge : `<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:${oP.bg};color:${oP.fg};">${esc(e.origen || '-')}</span>`}
                    </div>
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-20 flex-shrink-0">Sucursal</span><span class="text-gray-700 text-right">${esc(e.sucursal || '-')}</span></div>
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-20 flex-shrink-0">Almacen</span><span class="text-gray-700 text-right">${esc(e.almacen || '-')}</span></div>
                    ${e.proveedor ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-20 flex-shrink-0">Proveedor</span><span class="text-gray-700 text-right">${esc(e.proveedor)}</span></div>` : ''}
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-20 flex-shrink-0">Registrado</span><span class="text-gray-700 text-right">${esc(e.registrado || '-')}</span></div>
                    ${e.confirmadoPor ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-20 flex-shrink-0">Confirmado</span><span class="text-gray-700 text-right">${esc(e.confirmadoPor)}</span></div>` : ''}
                    ${e.nota ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-20 flex-shrink-0">Nota</span><span class="text-gray-700 text-right">${esc(e.nota)}</span></div>` : ''}
                </div>

                <div class="flex-1 overflow-y-auto px-4 py-3">
                    <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Productos (${(e.productos || []).length})</p>
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
                                <th class="text-left font-semibold py-1.5">Producto</th>
                                <th class="text-right font-semibold py-1.5 px-1">Precio</th>
                                <th class="text-center font-semibold py-1.5 px-1">Cant</th>
                                <th class="text-right font-semibold py-1.5 pl-1">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productosHtml}
                        </tbody>
                    </table>
                </div>

                <div class="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Unidades</span>
                        <span class="font-semibold text-gray-700" id="${opts.id}_totUds">${fmtUds(totUds)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-700">Total general</span>
                        <span class="text-lg font-bold text-gray-800" id="${opts.id}_totCosto">${fmtMoney(totCosto)}</span>
                    </div>
                </div>

                ${(opts.editMode || !isCancelled) ? `
                <div class="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
                    ${opts.editMode ? `
                        <button id="${opts.id}_saveEdit" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-1.5">
                            <i data-lucide="save" class="w-3.5 h-3.5"></i>${esc(opts.labels.guardar)}
                        </button>
                        <button id="${opts.id}_cancelEdit" class="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-1.5">
                            ${esc(opts.labels.cancelarEd)}
                        </button>
                    ` : `
                        ${isPending ? `
                            <button id="${opts.id}_confirm" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-green-600 hover:bg-green-500 flex items-center justify-center gap-1.5">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i>${esc(opts.labels.confirmar)}
                            </button>
                        ` : `
                            <button id="${opts.id}_edit" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-1.5">
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>${esc(opts.labels.editar)}
                            </button>
                        `}
                        <button id="${opts.id}_reverse" class="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5">
                            <i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.reversar)}
                        </button>
                    `}
                </div>
                ` : ''}
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $parent.find(`#${opts.id}_close`).on('click',      () => opts.onClose(e));
        $parent.find(`#${opts.id}_print`).on('click',      () => opts.onPrint(e));
        $parent.find(`#${opts.id}_reverse`).on('click',    () => opts.onReverse(e));
        $parent.find(`#${opts.id}_confirm`).on('click',    () => opts.onConfirm(e));
        $parent.find(`#${opts.id}_edit`).on('click',       () => opts.onEdit(e));
        $parent.find(`#${opts.id}_saveEdit`).on('click',   () => opts.onSaveEdit(e));
        $parent.find(`#${opts.id}_cancelEdit`).on('click', () => opts.onCancelEdit(e));

        // En edicion el total general sigue a las cantidades reales en vivo.
        if (opts.editMode) {
            const costMap = {};
            (e.productos || []).forEach(p => { costMap[String(p.detailId)] = Number(p.costo || 0); });
            $parent.find('.entrada-real-qty').on('input', () => {
                let uds = 0, costo = 0;
                $parent.find('.entrada-real-qty').each(function () {
                    const did = $(this).attr('data-detail-id');
                    const v = parseFloat($(this).val());
                    const q = isNaN(v) || v < 0 ? 0 : v;
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
