let api = 'ctrl/ctrl-pos-traspasos.php';
let app, traspasos, traspasosView;

let turno, subsidiaries_id;

// Config estatica de la vista (titulo, subtitulo, back). No son datos de negocio.
const VIEW_HEADER_TRASPASOS = {
    title:    'Visor de Traspasos',
    subtitle: 'Gestion de movimientos entre sucursales',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
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
        this.PROJECT_NAME = 'POSTraspasos';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        const r = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.dataInit = {
            subsidiaries_id: ok ? (r.subsidiaries_id  || '') : '',
            sucursales:      ok ? (r.sucursales       || []) : [],
            estados:         ok ? (r.estados_traspaso || []) : [],
            almacenes:       ok ? (r.almacenes        || []) : [],
            isAdmin:         ok ? !!r.is_admin : false,
            level:           ok ? (r.level || 0)  : 0
        };

        this.isAdmin    = this.dataInit.isAdmin;
        this.level      = this.dataInit.level;
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        traspasosView.renderHeader(VIEW_HEADER_TRASPASOS);
        traspasosView.renderFooter({});
        // traspasosView.renderTabs(this.PROJECT_NAME);
        traspasosView.renderDetail(null);
        this.populateFilters();
        traspasos.lsTraspasos();
        traspasos.lsKpis();
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
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
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
            class:'w-full md:w-[400px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
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
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    filterBar() {

        // Antepone una opcion "Todas/Todos" (id '') si el catalogo no la trae ya. Sin ella
        // el select se queda en la PRIMERA opcion real y lsTraspasos filtra por ese valor,
        // ocultando traspasos de otros estados/sucursales (incluido uno recien creado).
        const withAll = (list, label) => {
            const arr = list || [];
            return (arr[0] && (arr[0].id === '' || arr[0].id == null)) ? arr : [{ id: '', valor: label }].concat(arr);
        };
        const estados    = withAll(this.dataInit.estados,    'Todos los estados');
        const sucursales = withAll(this.dataInit.sucursales, 'Todas las sucursales');

        let filters = [
            {
                opc: 'input-calendar',
                id: `calendar${this.PROJECT_NAME}`,
                lbl: 'Rango de fecha:',
                class: 'col-12 col-md-3 col-lg-3'
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     estados
            },
            // El Origen no es un selector libre: se toma de la sucursal activa. Para roles
            // admin (niveles 1/5) la marca el selector de sucursal del navbar (sidebar) via
            // onBranchChange; para el resto queda fija a la sucursal de su sesion. Ver
            // getFilters() / onBranchChange().
            {
                opc:      'select',
                id:       'fDestino',
                lbl:      'Destino:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     sucursales
            },
         
            {
                opc:       'button',
                id:        'btnNuevoTraspaso',
                text:      'Nuevo Traspaso',
                class:     'col-12 col-md-2 col-lg-3',
                onClick:   () => traspasosView.openTraspasoForm()
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
            coffeesoft:true,
            theme:'dark',
            data:   filters
        });

        // Selector de rango de fechas (daterangepicker). Devuelve { fi, ff } via
        // getDataRangePicker en getFilters(). Default: mes actual, coherente con los KPIs.
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

    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('subsidiaries_id', sucursales);
            $('#subsidiaries_id').val(this.subId);
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
        const range = getDataRangePicker(`calendar${this.PROJECT_NAME}`) || {};
        // scope: SIEMPRE la sucursal activa. La lista muestra traspasos donde esa sucursal es
        // origen (salientes) O destino (entrantes), para que el destino vea sus entrantes y
        // pueda aceptarlos. Para admins (1/5) this.subId sigue al selector del navbar (sidebar)
        // via onBranchChange; para el resto es su sucursal de sesion.
        // destino: filtro opcional para acotar la contraparte dentro de ese alcance.
        return {
            subsidiaries_id: this.subId || '',
            scope:           this.subId           || '',
            estado:          $('#fEstado').val()  || '',
            destino:         $('#fDestino').val() || '',
            fechaIni:        range.fi             || '',
            fechaFin:        range.ff             || '',
            q:               $('#qBuscar').val()  || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        traspasos.lsTraspasos();
        await traspasos.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTraspaso(null);
        }
    }

    onChangeSucursal() {
        traspasos.lsTraspasos();
        traspasos.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTraspaso(null);
        }
    }

    // Cambio de sucursal desde el navbar (evento 'branchChanged' de coffeeSoft). Solo los
    // roles admin (1/5) muestran ese selector; al cambiarla, la sucursal activa pasa a ser
    // el nuevo origen del filtro y se refresca la lista sin reconstruir el layout.
    onBranchChange(detail) {
        if (detail && detail.id != null) {
            this.subId      = detail.id;
            subsidiaries_id = this.subId;
        }
        // El detalle abierto pertenece a la sucursal anterior: al cambiar de sucursal se
        // limpia siempre el visor (deselecciona la fila y vacia el panel de la derecha).
        this.selectTraspaso(null);
        traspasos.lsTraspasos();
        traspasos.lsKpis();
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    // -- Facade --

    // folio: resalta la fila (la tabla la identifica por su texto).
    // id:    pk numerica para el fetch del detalle (getTraspaso espera el id, no el folio).
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

    renderDetail(traspaso) {
        traspasosView.renderDetail(traspaso);
    }
}


class Traspasos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSTraspasos';
    }

    // -- Data --

    lsTraspasos() {
        const f = app.getFilters();

        this.createTable({
            parent:      'tableWrap',
            idFilterBar: 'filterBar',
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            data: {
                opc:                         'lsTraspasos',
                status_id:                   f.estado,
                scope_subsidiaries_id:       f.scope,
                destination_subsidiaries_id: f.destino,
                fi:                          f.fechaIni,
                ff:                          f.fechaFin,
                q:                           f.q
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'dark',
                f_size:       12,
                center:       [1,3,4, 5, 10],
                right:        [6],
                emptyMessage: 'No se encontraron traspasos con los filtros aplicados',
                emptyIcon:    'icon-arrow-left-right'
            }
        });
    }

    async lsKpis() {
        const r = await fn_ajax({ opc: 'showTraspasos', scope_subsidiaries_id: app.subId || '' }, api).catch(() => null);
        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiTotal',      label: 'Total Mes',    value: parseInt(c.total       || 0, 10), tone: 'default' },
            { id: 'kpiPendientes', label: 'Pendientes',   value: parseInt(c.pendientes  || 0, 10), tone: 'warning' },
            { id: 'kpiTransito',   label: 'En Transito',  value: parseInt(c.en_transito || 0, 10), tone: 'warning' },
            { id: 'kpiRecibidos',  label: 'Recibidos',    value: parseInt(c.recibidos   || 0, 10), tone: 'success' },
            { id: 'kpiRechazados', label: 'Rechazados',   value: parseInt(c.rechazados  || 0, 10), tone: 'danger'  }
        ];
        traspasosView.renderInfoCards(kpis);
    }

    async getTraspaso(id) {
        const r = await fn_ajax({ opc: 'getTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            traspasosView.renderDetail(this.mapTraspasoDetail(r.header || {}, r.detail || [], r.history || []));
        } else {
            traspasosView.renderDetail(null);
        }
    }

    // Normaliza la respuesta del backend (columnas DB) al shape que espera traspasoDetailPanel.
    // Analogo a mapMermaDetail: el panel se diseno contra sample_traspasos.js (estado, origen,
    // destino, productos, timeline); sin esta traduccion t.estado llega undefined y deja los
    // botones Confirmar/Rechazar siempre deshabilitados.
    mapTraspasoDetail(h, detail, history) {
        const toIso = (s) => s ? String(s).replace(' ', 'T') : '';

        return {
            id:         h.id,
            folio:      h.folio,
            estado:     h.status_name || '',
            fechaIso:   toIso(h.date_request),
            fechaEnvio: toIso(h.date_sent),
            solicito:   h.requested_user_name  || '',
            autoriza:   h.authorized_user_name || '',
            nota:       h.note || '',
            origen: {
                id:      h.origin_subsidiaries_id != null ? String(h.origin_subsidiaries_id) : '',
                nombre:  h.origin_subsidiary_name || '-',
                almacen: h.origin_warehouse_name || ''
            },
            destino: {
                id:      h.destination_subsidiaries_id != null ? String(h.destination_subsidiaries_id) : '',
                nombre:  h.destination_subsidiary_name || '-',
                almacen: h.destination_warehouse_name || ''
            },
            productos: (detail || []).map(d => ({
                nombre:           d.product_name || '',
                sku:              d.sku || '',
                cant:             Number(d.quantity || 0),
                costo:            Number(d.cost || 0),
                icon:             'package',
                bg:               'bg-gray-700/40',
                color:            'text-gray-300',
                stockOrigenPrev:  Number(d.origin_stock_prev      || 0),
                stockDestinoPrev: Number(d.destination_stock_prev || 0)
            })),
            timeline: (history || []).map(x => ({
                estado:   x.status_name || '',
                usuario:  x.user_name   || '',
                fechaIso: toIso(x.transitioned_at)
            }))
        };
    }

    // -- Actions --

    viewTraspaso(folio) {
        console.log('[viewTraspaso]', folio);
        app.selectTraspaso(folio);
    }

    async nuevoTraspaso(payload) {
        // El formulario (TraspasoForm) emite { origen, destino, categoria, productos[{productId,cant,costo}], nota }.
        // El backend saveTraspaso espera columnas DB: origin/destination_(subsidiaries|warehouse)_id,
        // note y productos[{product_id, quantity, cost}]. Sin esta traduccion los FK llegan en 0 y el
        // traspaso se inserta vacio (o falla por constraint) y no se visualiza en la lista.
        const origen  = payload.origen  || {};
        const destino = payload.destino || {};

        const backendPayload = {
            note:                        payload.nota || null,
            origin_subsidiaries_id:      origen.id,
            destination_subsidiaries_id: destino.id,
            origin_warehouse_id:         (origen.almacen  || {}).id,
            destination_warehouse_id:    (destino.almacen || {}).id,
            productos: (payload.productos || []).map(p => ({
                product_id: p.productId,
                quantity:   p.cant,
                cost:       p.costo
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

    async sendTraspaso(id) {
        const r = await fn_ajax({ opc: 'sendTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso enviado (en transito)' });
            this.lsTraspasos();
            this.lsKpis();
            traspasosView.renderDetail(null);
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo enviar el traspaso' });
        }
    }

    async confirmTraspaso(id) {
        const r = await fn_ajax({ opc: 'confirmTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso recibido' });
            this.lsTraspasos();
            this.lsKpis();
            traspasosView.renderDetail(null);
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo confirmar' });
        }
    }

    async rejectTraspaso(id) {
        const r = await fn_ajax({ opc: 'rejectTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso rechazado' });
            this.lsTraspasos();
            this.lsKpis();
            traspasosView.renderDetail(null);
        }
    }

    // Cancelar una solicitud aun no aceptada por el destino. Reutiliza el endpoint de
    // rechazo (marca el traspaso como terminal) con una nota que distingue la cancelacion
    // del solicitante de un rechazo del destino.
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
}


class TraspasosView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSTraspasos';
    }

    // -- Modal launchers --

    // Crea (una sola vez) la instancia del modal de traspaso con el mismo diseño que
    // EntradaForm (buscador + navegacion por teclado + popover de cantidad + tabla
    // del lote agrupada por categoria). Carga los catalogos una vez y la reusa.
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
                almacenes:       ok ? (r.almacenes    || []) : [],
                categorias:      ok ? (r.categorias   || []) : [],
                transformMap:    ok ? (r.transformMap || {}) : {},
                origenIdInicial: app.subId || (sucursales[0] && sucursales[0].id) || ''
            },
            onSave:  (payload) => traspasos.nuevoTraspaso(payload),
            onClose: () => console.log('[traspasoForm] cerrado')
        });
        return this.traspasoFormApi;
    }

    async openTraspasoForm() {
        await this.ensureTraspasoForm();
        // Sincroniza la sucursal origen con la seleccionada en el navbar en cada apertura.
        this.traspasoFormApi.setData({ origenIdInicial: app.subId || '' });
        this.traspasoFormApi.open();
    }

    // -- Render helpers --

    renderDetail(traspaso) {
        this.traspasoDetailPanel({
            parent:  'detailPanel',
            json:    traspaso,
            subId:   app.subId,
            onClose: () => {
                app.selectedId = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            },
            onConfirm: (t) => traspasos.confirmTraspaso(t && t.id),
            onReject:  (t) => traspasos.rejectTraspaso(t && t.id),
            onCancel:  (t) => traspasos.cancelTraspaso(t && t.id),
            onSend:    (t) => traspasos.sendTraspaso(t && t.id)
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json:   data
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    renderTabs(project) {
        this.tabsBar({
            parent: 'tabsRow',
            json: [
                { id: 'stock',        label: 'Stock Actual',  active: false, href: 'pos-stock.php'        },
                { id: 'movimientos',  label: 'Movimientos',   active: false, href: 'pos-movimientos.php'  },
                { id: 'entradas',     label: 'Entradas',      active: false, href: 'pos-entradas.php'     },
                { id: 'traspasos',    label: 'Traspasos',     active: true,  href: 'pos-traspasos.php'    },
                { id: 'mermas',       label: 'Mermas',        active: false, href: 'pos-mermas.php'       }
            ],
            onChange: (tab) => { if (tab && tab.href) window.location.href = tab.href; }
        });
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-5 gap-3',
            json:   [],
            labels: { empty: 'Sin indicadores' },
            tones: {
                default: 'text-white',
                success: 'text-[var(--cs-success,#3FC189)]',
                warning: 'text-[var(--cs-warning,#FBBF24)]',
                danger:  'text-[var(--cs-danger,#E02424)]',
                info:    'text-[var(--cs-info,#1C64F2)]',
                purple:  'text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
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
            grid.html(`<p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">${esc(opts.labels.empty)}</p>`);
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
            json:   { title: '', subtitle: '', back: null },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                backBtn:  'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-accent-purple,#7C3AED)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-accent-purple,#7C3AED)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
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
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

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
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)] flex-wrap',
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

    tabsBar(options) {
        const defaults = {
            parent: 'root',
            id:     'tabsBar',
            class:  'flex items-center gap-1 border-b border-transparent overflow-x-auto',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer whitespace-nowrap',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer whitespace-nowrap'
            },
            onChange: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html((opts.json || []).map(tab => `
            <button type="button"
                    data-tab-id="${esc(tab.id)}"
                    class="${tab.active ? opts.classes.tabActive : opts.classes.tab}">
                ${esc(tab.label)}
            </button>
        `).join(''));

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-tab-id]', (e) => {
            const id  = $(e.currentTarget).attr('data-tab-id');
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    traspasoDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'traspasoDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] flex flex-col overflow-hidden',
            json:      null,
            subId:     null,
            labels: {
                emptyTitle: 'Selecciona un traspaso',
                emptyHint:  'Haz click en una fila para ver el detalle completo aqui.',
                subtitle:   'Detalle del traspaso',
                ruta:       'Ruta del traspaso',
                origen:     'Origen',
                destino:    'Destino',
                enRuta:     'en ruta',
                solicito:   'Solicito',
                autoriza:   'Autoriza',
                fSolicitud: 'Fecha solicitud',
                fEnvio:     'Fecha envio',
                totProd:    'Total productos',
                costoTot:   'Costo total',
                productos:  'Productos en traspaso',
                detalleProductos: 'Detalle de productos',
                producto:   'Producto',
                historial:  'Historial',
                nota:       'Nota',
                cant:       'Cant',
                costo:      'Costo',
                subtot:     'Subtotal',
                stockO:     'Stock origen',
                stockD:     'Stock destino',
                rechazar:   'Rechazar',
                cancelar:   'Cancelar Solicitud',
                enviar:     'Enviar Traspaso',
                aceptar:    'Aceptar Envio',
                confirmar:  'Confirmar Recepcion'
            },
            estadoPalettes: {
                'Solicitado':   { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Pendiente':    { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Autorizado':   { bg: 'rgba(167,139,250,0.15)', fg: '#A78BFA' },
                'En Transito':  { bg: 'rgba(251,146,60,0.15)',  fg: '#FB923C' },
                'Recibido':     { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' },
                'Rechazado':    { bg: 'rgba(244,63,94,0.15)',   fg: '#F43F5E' }
            },
            sucPalettes: {
                'kafeto':  { bg: 'bg-green-500/15',            color: 'text-green-400',     borderHex: 'rgba(63,193,137,0.35)',  bgHex: 'rgba(63,193,137,0.15)'  },
                'central': { bg: 'bg-[rgba(28,100,242,0.15)]', color: 'text-[#76A9FA]',     borderHex: 'rgba(28,100,242,0.35)',  bgHex: 'rgba(28,100,242,0.15)'  },
                'norte':   { bg: 'bg-purple-500/15',           color: 'text-purple-400',    borderHex: 'rgba(168,85,247,0.35)',  bgHex: 'rgba(168,85,247,0.15)'  },
                'sur':     { bg: 'bg-pink-500/15',             color: 'text-pink-400',      borderHex: 'rgba(244,114,182,0.35)', bgHex: 'rgba(244,114,182,0.15)' }
            },
            timelineDots: {
                'Solicitado':  'bg-[#76A9FA]',
                'Autorizado':  'bg-yellow-400',
                'En Transito': 'bg-orange-400',
                'Recibido':    'bg-green-400',
                'Rechazado':   'bg-red-400'
            },
            onClose:   () => { },
            onConfirm: () => { },
            onReject:  () => { },
            onCancel:  () => { },
            onSend:    () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});
        opts.sucPalettes    = Object.assign({}, defaults.sucPalettes,    o.sucPalettes    || {});
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
            const dow = DOW[d.getDay()];
            const day = String(d.getDate()).padStart(2, '0');
            const mon = MON[d.getMonth()];
            let h     = d.getHours();
            const m   = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        // -- Estado vacio
        if (!opts.json) {
            aside.html(`
                <div class="px-3 py-3 flex-shrink-0">
                    <h3 class="text-sm font-bold text-white">Detalle Traspaso</h3>
                    <p class="text-[10px] text-[#9CA3AF]">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[#1F2937] flex items-center justify-center mb-3">
                        <i data-lucide="arrow-left-right" class="w-6 h-6 text-[#9CA3AF]"></i>
                    </div>
                    <p class="text-[11px] text-[#9CA3AF]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[#9CA3AF] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        // -- Render con traspaso
        const t        = opts.json;
        const items    = (t.productos || []).length;
        const uds      = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0), 0);
        const costoTot = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0) * Number(p.costo || 0), 0);
        const estadoC  = opts.estadoPalettes[t.estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
        const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(t.estado)}</span>`;

        // Nodo de sucursal (origen/destino) en columna: icono grande coloreado,
        // etiqueta y nombre. Color estable por id de sucursal (consistente con la
        // tabla); si hay paleta por slug en sucPalettes (datos de muestra) la respeta.
        const routePalette = [
            { icon: 'text-blue-400',   bgHex: 'rgba(59,130,246,0.15)',  borderHex: 'rgba(59,130,246,0.35)' },
            { icon: 'text-green-400',  bgHex: 'rgba(63,193,137,0.15)',  borderHex: 'rgba(63,193,137,0.35)' },
            { icon: 'text-purple-400', bgHex: 'rgba(168,85,247,0.15)',  borderHex: 'rgba(168,85,247,0.35)' },
            { icon: 'text-pink-400',   bgHex: 'rgba(244,114,182,0.15)', borderHex: 'rgba(244,114,182,0.35)' },
            { icon: 'text-orange-400', bgHex: 'rgba(251,146,60,0.15)',  borderHex: 'rgba(251,146,60,0.35)' },
            { icon: 'text-cyan-400',   bgHex: 'rgba(34,211,238,0.15)',  borderHex: 'rgba(34,211,238,0.35)' }
        ];
        const sucNode = (suc, label) => {
            const sp    = opts.sucPalettes[suc.id];
            const idNum = parseInt(suc.id, 10);
            const pal   = !isNaN(idNum) ? routePalette[idNum % routePalette.length] : routePalette[0];
            const p     = sp ? { icon: sp.color, bgHex: sp.bgHex, borderHex: sp.borderHex } : pal;
            return `
                <div class="flex flex-col items-center text-center gap-1.5 flex-1 min-w-0">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${p.bgHex};">
                        <i data-lucide="store" class="w-4 h-4 ${p.icon}"></i>
                    </div>
                    <div class="min-w-0 w-full">
                        <p class="text-[8px] text-[#9CA3AF] uppercase tracking-wider leading-none">${esc(label)}</p>
                        <p class="text-[11px] font-bold text-white truncate leading-tight mt-0.5">${esc(suc.nombre)}</p>
                        ${suc.almacen ? `<p class="text-[9px] text-[#9CA3AF] truncate leading-tight">${esc(suc.almacen)}</p>` : ''}
                    </div>
                </div>`;
        };

        // Detalle de productos estilo "ticket": card con header (titulo + contador),
        // nombre + costo unitario y columnas Cant/Costo/Subtotal alineadas. Cierra con
        // una fila Total destacada.
        const productosTable = () => {
            const rows = (t.productos || []).map((p) => {
                const subtotal = Number(p.cant) * Number(p.costo);
                return `
                    <tr class="border-b border-[#374151]/60 last:border-0 hover:bg-[#111827]/40 transition-colors">
                        <td class="py-2 px-2">
                            <div class="min-w-0">
                                <p class="text-[10px] font-bold text-white leading-tight truncate">${esc(p.nombre)}</p>
                                <p class="text-[9px] text-[#9CA3AF] leading-tight">${fmtMoney(p.costo)} c/u</p>
                            </div>
                        </td>
                        <td class="py-2 px-1 text-center font-bold text-blue-400 whitespace-nowrap text-[10px]">${p.cant}</td>
                        <td class="py-2 px-1 text-right text-[#9CA3AF] whitespace-nowrap truncate text-[10px]">${fmtMoney(p.costo)}</td>
                        <td class="py-2 px-2 text-right text-white font-bold whitespace-nowrap truncate text-[10px]">${fmtMoney(subtotal)}</td>
                    </tr>`;
            }).join('');

            const foot = items ? `
                <tfoot>
                    <tr class="border-t border-[#374151]">
                        <td class="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Total</td>
                        <td class="py-2.5 px-1 text-center font-bold text-blue-400 whitespace-nowrap">${uds}</td>
                        <td class="py-2.5 px-1"></td>
                        <td class="py-2.5 px-2 text-right text-sm font-bold text-blue-400 whitespace-nowrap truncate">${fmtMoney(costoTot)}</td>
                    </tr>
                </tfoot>` : '';

            return `
                <div class="bg-[#1F2937] rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2.5 border-b border-[#374151]">
                        <p class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">${esc(opts.labels.detalleProductos)}</p>
                        <p class="text-[10px] text-[#9CA3AF]">${items} productos &middot; ${uds} uds</p>
                    </div>
                    <table class="w-full text-[11px] border-collapse table-fixed">
                        <thead>
                            <tr class="text-[9px] text-[#9CA3AF] uppercase tracking-wider border-b border-[#374151]">
                                <th class="py-2 px-2 text-left font-bold">${esc(opts.labels.producto)}</th>
                                <th class="py-2 px-1 text-center font-bold w-10">${esc(opts.labels.cant)}</th>
                                <th class="py-2 px-1 text-right font-bold w-16">${esc(opts.labels.costo)}</th>
                                <th class="py-2 px-2 text-right font-bold w-20">${esc(opts.labels.subtot)}</th>
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="4" class="py-2 text-center text-[11px] text-gray-500 italic">Sin productos</td></tr>`}</tbody>
                        ${foot}
                    </table>
                </div>`;
        };

        const timelineHtml = (t.timeline || []).map((tl, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const dot = opts.timelineDots[tl.estado] || 'bg-gray-400';
            return `
                <div class="relative ${isLast ? '' : 'pb-3'}">
                    <div class="absolute -left-[17px] top-0 w-2.5 h-2.5 rounded-full ${dot} border-2 border-[var(--cs-bg-header,#141d2b)]"></div>
                    <p class="text-[10px] font-medium">${esc(tl.estado)} <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(tl.usuario || '')}</span></p>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(fmtFecha(tl.fechaIso))}</p>
                </div>
            `;
        }).join('') || '<p class="text-[10px] text-gray-500 italic">Sin historial</p>';

        // Acciones segun estado Y rol de la sucursal activa (opts.subId) frente al traspaso:
        // - Solicitado:
        //     * Si la activa es el ORIGEN: solo puede cancelar su propia solicitud.
        //     * Si la activa es el DESTINO: puede Aceptar Envio (mueve a En Transito) o Rechazar.
        // - Autorizado / En Transito (ya aceptado):
        //     * Si la activa es el DESTINO: Confirmar Recepcion (descuenta origen / suma destino) o Rechazar.
        // - Recibido / Rechazado: terminal, sin acciones.
        // - Cualquier otra sucursal observadora: solo lectura (sin botones).
        const subId     = opts.subId != null ? String(opts.subId) : '';
        const origenId  = (t.origen  && t.origen.id  != null) ? String(t.origen.id)  : '';
        const destinoId = (t.destino && t.destino.id != null) ? String(t.destino.id) : '';
        const isOrigin  = subId !== '' && subId === origenId;
        const isDestino = subId !== '' && subId === destinoId;

        const isRequested = t.estado === 'Solicitado' || t.estado === 'Pendiente';
        const inTransit   = t.estado === 'Autorizado' || t.estado === 'En Transito';

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
                <i data-lucide="send" class="w-3.5 h-3.5"></i>${esc(opts.labels.aceptar)}
            </button>`;
        const btnConfirm = `
            <button type="button" id="${opts.id}_primary"
                    class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.confirmar)}
            </button>`;

        // mode determina que handlers se enganchan; '' => panel de solo lectura.
        let actionsHtml = '';
        let mode        = '';
        if (isRequested && isOrigin)       { actionsHtml = btnCancel;             mode = 'cancel';  }
        else if (isRequested && isDestino) { actionsHtml = btnReject + btnAccept; mode = 'accept';  }
        else if (inTransit  && isDestino)  { actionsHtml = btnReject + btnConfirm; mode = 'confirm'; }

        aside.html(`
            <div class="px-3 py-3 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-[#c4b5fd]">Traspaso ${esc(t.folio)}</h3>
                    <p class="text-[10px] text-[#9CA3AF]">${esc(fmtFecha(t.fechaIso))}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${estadoBadge}
                    <button id="${opts.id}_close" class="text-[#D1D5DB] hover:text-white transition-colors p-1" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-3">

                <!-- Ruta del traspaso -->
                <div class="bg-[#1F2937] rounded-lg p-2.5">
                    <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-2">${esc(opts.labels.ruta)}</p>
                    <div class="flex items-start gap-2">
                        ${sucNode(t.origen, opts.labels.origen)}
                        <div class="flex flex-col items-center gap-0.5 flex-shrink-0 pt-2">
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-[#c4b5fd]"></i>
                            <span class="text-[8px] text-[#9CA3AF]">${esc(opts.labels.enRuta)}</span>
                        </div>
                        ${sucNode(t.destino, opts.labels.destino)}
                    </div>
                </div>

                <!-- Metadata -->
                <div class="bg-[#1F2937] rounded-lg p-3 space-y-1.5">
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.solicito)}</span><span class="font-medium">${esc(t.solicito || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.autoriza)}</span><span class="font-medium">${esc(t.autoriza || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.fSolicitud)}</span><span>${esc(fmtFecha(t.fechaIso))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.fEnvio)}</span><span>${esc(fmtFecha(t.fechaEnvio))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.totProd)}</span><span class="font-bold">${items} tipos / ${uds} uds</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.costoTot)}</span><span class="font-bold text-[#76A9FA]">${fmtMoney(costoTot)}</span></div>
                </div>

                <!-- Productos (detalle estilo ticket) -->
                ${productosTable()}

                <!-- Timeline -->
                <div>
                    <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-2">${esc(opts.labels.historial)}</p>
                    <div class="space-y-0 border-l-2 border-[#374151] ml-2 pl-3">
                        ${timelineHtml}
                    </div>
                </div>

                <!-- Nota -->
                ${t.nota ? `
                <div class="bg-[#1F2937] rounded-lg p-3">
                    <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-1">${esc(opts.labels.nota)}</p>
                    <p class="text-[11px] text-gray-300">${esc(t.nota)}</p>
                </div>` : ''}
            </div>

            ${actionsHtml ? `<div class="px-3 py-3 flex gap-2 flex-shrink-0">${actionsHtml}</div>` : ''}
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(t));
        if (mode === 'cancel') {
            $(`#${opts.id}_cancel`).on('click', () => opts.onCancel(t));
        } else if (mode === 'accept') {
            $(`#${opts.id}_reject`).on('click', () => opts.onReject(t));
            $(`#${opts.id}_accept`).on('click', () => opts.onSend(t));
        } else if (mode === 'confirm') {
            $(`#${opts.id}_reject`).on('click',  () => opts.onReject(t));
            $(`#${opts.id}_primary`).on('click', () => opts.onConfirm(t));
        }
    }
}
