let apiSalidas = 'ctrl/ctrl-salidas.php';
let apiAlmacen = 'ctrl/ctrl-almacen.php';
let app, salidas, salidasView;

let branch_id;

const VIEW_HEADER_SALIDAS = {
    title:    'Salidas de Inventario',
    subtitle: 'Control de salidas por sucursal, motivo y periodo'
};

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
        this.resizePanel();
        this.filterBar();
        salidasView.renderDetail(null);
        this.populateFilters();
        this.updateHeaderTitle();
        salidas.lsSalidas();
        salidas.lsKpis();
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
            ? `${VIEW_HEADER_SALIDAS.title} <span class="font-bold" style="color:rgb(var(--brand-600, 192 90 64));">&middot; ${esc(branchName)}</span>`
            : VIEW_HEADER_SALIDAS.title;

        salidasView.renderHeader(Object.assign({}, VIEW_HEADER_SALIDAS, { titleHtml }));
    }

    layout() {
        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 dark:!border-0 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 dark:!border-0 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 dark:!border-0 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        // Tirador entre la tabla y el visor: el ancho del visor vive en --salidas-detail-w.
        const detailResizer = {
            type:  'div',
            id:    'detailResizer',
            class: "hidden md:block relative z-[5] flex-shrink-0 w-[6px] -mx-[3px] cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class: 'w-full md:w-[var(--salidas-detail-w,420px)] md:max-w-[60vw] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 dark:!border-0 flex flex-col overflow-hidden',
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
                class:     'cs-visor flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200 dark:!border-0',
                container: [mainPanel, detailResizer, detailPanel]
            }
        });
    }

    // Arrastrar el tirador cambia el ancho del visor y la tabla toma el resto.
    // Sin ancho guardado, en laptop (< 1600 px) el visor arranca más angosto.
    resizePanel() {
        const handle = document.getElementById('detailResizer');
        const panel  = document.getElementById('detailPanel');
        if (!handle || !panel) return;

        this.applyPanelWidth(this.savedPanelWidth() || (window.innerWidth < 1600 ? 340 : 420), false);
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', 'Ancho del detalle de la salida');

        const move = (e) => this.applyPanelWidth(panel.getBoundingClientRect().right - e.clientX, false);

        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            handle.classList.add('after:bg-blue-600');
            document.body.style.cursor     = 'col-resize';
            document.body.style.userSelect = 'none';

            const release = () => {
                handle.classList.remove('after:bg-blue-600');
                document.body.style.cursor     = '';
                document.body.style.userSelect = '';
                handle.removeEventListener('pointermove', move);
                this.applyPanelWidth(panel.getBoundingClientRect().width, true);
            };

            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', release, { once: true });
            handle.addEventListener('pointercancel', release, { once: true });
        });
    }

    applyPanelWidth(px, save) {
        const width = Math.round(Math.min(760, Math.max(300, px)));
        document.documentElement.style.setProperty('--salidas-detail-w', `${width}px`);

        if (!save) return;
        try {
            localStorage.setItem('inventory:salidas:detailWidth', width);
        } catch (e) { }
    }

    savedPanelWidth() {
        try {
            const px = Number(localStorage.getItem('inventory:salidas:detailWidth'));
            return px > 0 ? px : null;
        } catch (e) {
            return null;
        }
    }

    filterBar() {
        let filters = [
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
                color_btn: 'primary',
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
                    format:           'DD-MM-YYYY',
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
        const $branch = $('#branch_id');
        return {
            // Respetamos el select aunque valga '' (-- Todas --); solo caemos a la
            // sucursal del usuario si el select aun no existe en el DOM.
            branch_id: $branch.length ? ($branch.val() || '') : (this.subId || ''),
            fi:              this.rangeFi               || '',
            ff:              this.rangeFf               || '',
            motivo:          $('#fMotivo').val()        || '',
            status:          $('#fEstado').val()        || ''
        };
    }

    async onChangeFilters() {
        this.updateHeaderTitle();
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
            center:       [2, 3, 4, 7, 8],
            right:        [6],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron salidas con los filtros aplicados',
            emptyIcon:    'icon-trash-empty',
            data:         data
        });

        const total = (data.row || []).length;
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }
        if (window.lucide) lucide.createIcons();
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
            { id: 'kpiPerdida',   label: 'Valor de salidas', value: fmt(c.total_costo),                tone: 'default' },
            { id: 'kpiRegistros', label: 'Registros',     value: parseInt(c.total_salidas   || 0, 10),  tone: 'default' },
            { id: 'kpiUnidades',  label: 'Unidades',      value: parseInt(c.total_unidades || 0, 10),  tone: 'warning' },
            { id: 'kpiCanceladas', label: 'Canceladas',   value: parseInt(c.total_canceladas || 0, 10),  tone: 'danger'  }
        ];
        salidasView.renderInfoCards(kpis);
    }

    async lsKpiDetail(kpi) {
        const views = {
            kpiPerdida:    { title: 'Valor de salidas por producto', center: [2, 3, 5], right: [4] },
            kpiRegistros:  { title: 'Registros por tipo de salida',  center: [2, 3, 5], right: [4] },
            kpiUnidades:   { title: 'Unidades por producto',         center: [2, 3, 4], right: [] },
            kpiCanceladas: { title: 'Salidas canceladas',            center: [2, 3, 5], right: [6], size: 'xl' }
        };
        const view = views[kpi.id];
        if (!view) return;

        const f = app.getFilters();
        const r = await useFetch({
            url:  apiSalidas,
            data: {
                opc:       'lsKpiDetail',
                kpi:       kpi.id,
                branch_id: f.branch_id,
                reason_id: f.motivo,
                status:    f.status,
                fi:        f.fi,
                ff:        f.ff
            }
        });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cargar el desglose' });
            return;
        }

        const branch = (app.dataInit.sucursales || []).find(s => String(s.id) === String(f.branch_id));

        salidasView.kpiDetailModal(Object.assign({}, view, {
            value:    kpi.value,
            subtitle: `Del ${moment(f.fi).format('DD/MM/YYYY')} al ${moment(f.ff).format('DD/MM/YYYY')} · ${branch ? branch.valor : 'Todas las sucursales'}`,
            data:     { row: r.row || [] }
        }));
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
            motivo_bg:      h.reason_bg    || '',
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
                area:        d.area_name     || '',
                unidad:      d.unit          || '',
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
                        app.alertBox({ type: 'success', title: r.message || ('Salida ' + r.folio + ' registrada'), timer: 2200 });
                        this.lsSalidas();
                        this.lsKpis();
                    } else {
                        app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo registrar la salida' });
                    }
                },
                onOpenIA: () => this.openChatIA(),
                onClose:  () => { if (this.chatIA) this.chatIA.close(); }
            });
        }
        this.salidaFormApi.setData({ branch_id: curSub, fecha: moment().format('YYYY-MM-DD') });
        this.salidaFormApi.open();
    }

    // -- CoffeeIA --

    // El mismo chat de Catálogo y Entradas (iaChat): se adjunta la nota o un Excel,
    // la IA propone qué sale, se revisa en la vista previa y lo marcado entra al lote.
    openChatIA() {
        if (!this.chatIA) {
            this.chatIA = this.iaChat({
                id:          'chatSalidaIA',
                title:       'CoffeeIA',
                subtitle:    'Revisa y captura la salida desde una foto o un Excel',
                placeholder: 'Adjunta la nota de salida o escribe qué sale…',
                accept:      '.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv',
                welcome:     'Adjunta la foto de la nota, hoja de salida o lista. Te digo qué productos salen, cuáles no están en el catálogo y cuáles no tienen stock suficiente. Nada entra sin tu confirmación.',
                actions: {
                    add: {
                        label: 'Agregar',
                        tone:  'bg-emerald-100 text-emerald-700'
                    },
                    missing: {
                        label: 'Falta',
                        tone:  'bg-amber-100 text-amber-700'
                    },
                    exists: {
                        label: 'Ya está',
                        tone:  'bg-gray-100 text-gray-500'
                    }
                },
                onAttach:  (file) => this.readArchivoIA(file),
                onSend:    (text, adjuntos, historial, progress) => this.askSalidaIA(text, adjuntos, historial, progress),
                onConfirm: (token, ids) => this.applySalidaIA(token, ids)
            });
        }
        this.chatIA.open();
    }

    // Misma lectura que el chat de Catálogo (ctrl-almacen::readArchivo).
    async readArchivoIA(file) {
        const data = new FormData();
        data.append('opc', 'readArchivo');
        data.append('archivo', file);

        try {
            const response = await fetch(apiAlmacen, {
                method:      'POST',
                credentials: 'same-origin',
                body:        data
            });
            return await response.json();
        } catch (e) {
            return { status: 500, message: 'No pude leer el archivo.' };
        }
    }

    // Revisión: lo que ya tiene renglón en la salida no se vuelve a agregar (queda
    // como "Ya está", sin casilla), y con el stock del almacén elegido en el modal se
    // avisa qué dejaría el stock en negativo (se puede agregar igual, como al capturar
    // a mano). La barra del chat avanza con los dos pasos: buscar en el catálogo (el
    // 90 % del trabajo, lo hace el modelo) y revisar el stock.
    async askSalidaIA(text, adjuntos, historial, progress) {
        const catalogo = this.salidaFormApi ? (this.salidaFormApi.opts.json || []) : [];
        const pedido   = adjuntos.length
            ? `lo de ${adjuntos.map(a => a.nombre).join(', ')}`
            : `«${text.length > 40 ? text.slice(0, 40) + '…' : text}»`;

        progress(`Buscando ${pedido} entre ${catalogo.length} productos del catálogo`, 0.9);

        const r = await useFetch({
            url:  apiSalidas,
            data: {
                opc:       'askSalidaIA',
                mensaje:   text,
                adjuntos:  JSON.stringify(adjuntos),
                historial: JSON.stringify(historial)
            }
        }).catch(() => null);

        if (!(r && r.status === 200)) return r || { status: 500, message: 'CoffeeIA no respondió. Inténtalo otra vez.' };

        const form    = this.salidaFormApi;
        const almacen = form ? $(`#${form.opts.id}_selAlmacen option:selected`).text().trim() : '';
        progress(`Revisando el stock de ${almacen || 'el almacén'}`, 1);

        const yaEstan = this.marcarYaEnSalida(r.row || []);
        if (yaEstan) {
            r.reply = `${r.reply || ''}\n${yaEstan} ${yaEstan === 1 ? 'ya está' : 'ya están'} en la salida: no los vuelvo a agregar.`.trim();
        }

        const usado = {};
        (r.row || []).forEach((x) => {
            if (x.action !== 'add') return;
            const prod  = catalogo.find(p => String(p.id) === String(x.product_id));
            const stock = Number(((prod ? Number(prod.stock || 0) : 0) - (usado[x.product_id] || 0)).toFixed(2));
            usado[x.product_id] = (usado[x.product_id] || 0) + Number(x.cantidad);
            if (Number(x.cantidad) > stock) x.warn = `Stock insuficiente: hay ${stock}`;
        });

        if (r.token) this.iaPropuesta = { token: r.token, row: r.row || [] };
        return r;
    }

    // Los renglones "add" de un producto que ya está en la salida pasan a "exists".
    // Devuelve cuántos cambió.
    marcarYaEnSalida(rows) {
        const enSalida = new Set((this.salidaFormApi ? this.salidaFormApi.lote : []).map(p => String(p.id)));
        let n = 0;
        rows.forEach((x) => {
            if (x.action !== 'add' || !enSalida.has(String(x.product_id))) return;
            Object.assign(x, { action: 'exists', valid: false, note: 'Ya está en la salida: no lo vuelvo a agregar.' });
            n++;
        });
        return n;
    }

    // Al aplicar se revisa otra vez: entre la vista previa y el clic en Aplicar se
    // pudo capturar a mano alguno de esos productos.
    applySalidaIA(token, ids) {
        const pv   = this.iaPropuesta;
        const form = this.salidaFormApi;
        if (!pv || pv.token !== token) return { status: 400, message: 'Esa vista previa ya no es válida. Pídemela otra vez.' };
        if (!form || form.wrap.hasClass('hidden')) return { status: 400, message: 'Abre la salida para agregar los productos.' };

        const desmarcados = pv.row.filter(x => x.valid && x.action === 'add' && !ids.includes(x.idx));
        this.marcarYaEnSalida(pv.row.filter(x => ids.includes(x.idx)));

        const catalogo = form.opts.json || [];
        const items    = pv.row
            .filter(x => x.valid && x.action === 'add' && ids.includes(x.idx))
            .map(x => ({ prod: catalogo.find(p => String(p.id) === String(x.product_id)), cantidad: x.cantidad, name: x.name }));

        const n     = form.addFromIA(items);
        const fuera = [
            ...pv.row.filter(x => x.action === 'exists').map(x => `${x.name} (${x.cantidad}): ya estaba en la salida`),
            ...pv.row.filter(x => x.action === 'missing').map(x => `${x.name} (${x.cantidad}): no está en el catálogo`),
            ...items.filter(i => !i.prod).map(i => `${i.name} (${i.cantidad}): no está en el catálogo`),
            ...desmarcados.map(x => `${x.name} (${x.cantidad}): lo desmarcaste`)
        ];

        const message = `Agregué ${n} ${n === 1 ? 'producto' : 'productos'} a la salida.`;
        return {
            status:  200,
            message: fuera.length ? `${message}\nNo agregué ${fuera.length}:\n• ${fuera.join('\n• ')}` : message
        };
    }

    async printSalida(arg) {
        let m = arg;
        if (!m || typeof m !== 'object') {
            const r = await useFetch({ url: apiSalidas, data: { opc: 'getSalida', id: arg } });
            if (!(r && r.status === 200)) {
                app.alertBox({ type: 'error', title: 'No se pudo cargar la salida para imprimir' });
                return;
            }
            m = this.mapSalidaDetail(r.header || {}, r.detail || []);
        }
        this.renderSalidaDoc(m);
    }

    renderSalidaDoc(m) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtUds   = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

        // Mismo formato que el comprobante de entrada (entradas.js::_renderEntradaDoc).
        const items  = m.items || [];
        const subOf  = (it) => it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * Number(it.costo_unit || 0);
        const totals = items.reduce((acc, it) => {
            acc.uds   += Number(it.qty || 0);
            acc.costo += subOf(it);
            return acc;
        }, { uds: 0, costo: 0 });
        const totUds   = m.total_unidades != null ? m.total_unidades : totals.uds;
        const totCosto = m.total_costo    != null ? m.total_costo    : totals.costo;

        const rowsHtml = items.map(it => {
            const cu = Number(it.costo_unit || 0);
            return `<tr><td class="prod"><span class="prod-name">${esc(it.name)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td><td class="c">-${fmtUds(it.qty)}</td><td class="r">${fmtMoney(cu)}</td><td class="r">-${fmtMoney(subOf(it))}</td><td class="c">${esc(it.unidad || '-')}</td></tr>`;
        }).join('');

        const reg = m.registrado_por && m.registrado_por.name ? m.registrado_por.name : '-';

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Salida ${esc(m.folio||'')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800;color:#000}.folio{font-size:20px;font-weight:800;color:#000;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px;color:#000}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right;color:#000}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2;color:#000}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}.firmas{display:flex;justify-content:space-between;gap:64px;margin-top:72px;page-break-inside:avoid}.firma{flex:1;text-align:center;font-size:11px;color:#000}.firma .linea{border-top:1px solid #000;margin-bottom:6px}.firma .rol{font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px}.firma .sub{color:#777;font-size:10px;margin-top:2px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Comprobante de Salida</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(m.sucursal||'')}${m.almacen?' &middot; '+esc(m.almacen):''}</div></div><div><div class="folio">${esc(m.folio||'-')}</div>${m.status?`<span class="status">${esc(m.status)}</span>`:''}</div></div>
            <div class="info-grid"><div class="info-item"><span class="k">Tipo de salida</span><span class="v">${esc(m.motivo||'-')}</span></div><div class="info-item"><span class="k">Fecha</span><span class="v">${esc(fmtFecha(m.fecha))}</span></div><div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(m.sucursal||'-')}</span></div><div class="info-item"><span class="k">Origen</span><span class="v">${esc(m.almacen||'-')}</span></div><div class="info-item"><span class="k">Registrado por</span><span class="v">${esc(reg)}</span></div></div>
            <table><thead><tr><th>Producto</th><th class="c">Cant</th><th class="r">Costo unit.</th><th class="r">Importe</th><th class="c">Unidad</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="5" class="c">Sin productos</td></tr>'}</tbody></table>
            <div class="totals"><div class="totals-box"><div class="totals-row"><span>Tipos de producto</span><span>${items.length}</span></div><div class="totals-row"><span>Unidades</span><span>-${fmtUds(totUds)}</span></div><div class="totals-row grand"><span>Valor de salidas</span><span>-${fmtMoney(totCosto)}</span></div></div></div>
            ${m.nota?`<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;color:#222"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(m.nota)}</div>`:''}
            <div class="firmas"><div class="firma"><div class="linea"></div><div class="rol">Almacenista</div><div class="sub">Nombre y firma</div></div><div class="firma"><div class="linea"></div><div class="rol">Supervisor</div><div class="sub">Nombre y firma</div></div></div>
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) { app.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' }); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    // Resuelve true si la contraseña del usuario en sesión es correcta; con una
    // equivocada vuelve a preguntar y con Cancelar resuelve false.
    askCancelPassword(id, retry) {
        return new Promise((resolve) => {
            app.alertBox({
                type:             'confirm',
                icon:             'lock',
                title:            'Confirma tu contraseña',
                detailHtml:       retry
                    ? 'Contraseña incorrecta. Intenta de nuevo.'
                    : 'Para cancelar la salida escribe tu contraseña.',
                input:            'password',
                inputPlaceholder: 'Tu contraseña',
                inputRequired:    true,
                inputError:       'Escribe tu contraseña',
                okLabel:          'Continuar',
                cancelLabel:      'Cancelar',
                onOk: async (password) => {
                    const r = await useFetch({
                        url:  apiSalidas,
                        data: {
                            opc:      'verifyCancelPassword',
                            id:       id,
                            password: password
                        }
                    }).catch(() => null);

                    if (r && r.status === 200) { resolve(true); return; }
                    if (r && r.status === 401) { resolve(await this.askCancelPassword(id, true)); return; }

                    app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo verificar la contraseña' });
                    resolve(false);
                },
                onCancel: () => resolve(false)
            });
        });
    }

    async cancelSalida(id) {
        if (!(await this.askCancelPassword(id))) return;

        app.alertBox({
            type:        'cancel',
            title:       'Cancelar esta salida?',
            detailHtml:  'El stock de los productos sera restaurado. Accion irreversible.',
            okLabel:     'Sí, cancelar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiSalidas, data: { opc: 'cancelSalida', id: id } });
                if (r && r.status === 200) {
                    app.alertBox({ type: 'success', title: r.message || 'Salida cancelada', timer: 2200 });
                    salidasView.renderDetail(null);
                    this.lsSalidas();
                    this.lsKpis();
                } else {
                    app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar' });
                }
            }
        });
    }

    deleteSalida(id) {
        app.alertBox({
            type:        'cancel',
            title:       'Eliminar esta salida?',
            detailHtml:  'El formato cancelado se quitara del visor. Accion irreversible.',
            okLabel:     'Sí, eliminar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiSalidas, data: { opc: 'deleteSalida', id: id } });
                if (r && r.status === 200) {
                    app.alertBox({ type: 'success', title: r.message || 'Salida eliminada', timer: 2200 });
                    salidasView.renderDetail(null);
                    this.lsSalidas();
                    this.lsKpis();
                } else {
                    app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo eliminar' });
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
            app.alertBox({ type: 'success', title: r.message || 'Evidencia actualizada', timer: 2200 });
            this.getSalida(id);
        } else {
            app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar la evidencia' });
        }
    }

    removeEvidence(id) {
        app.alertBox({
            type:        'cancel',
            title:       'Quitar evidencia?',
            detailHtml:  'Se eliminara la foto de evidencia de esta salida.',
            okLabel:     'Sí, quitar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: apiSalidas, data: { opc: 'saveSalidaEvidence', id: id, evidence_b64: '' } });
                if (r && r.status === 200) {
                    app.alertBox({ type: 'success', title: r.message || 'Evidencia eliminada', timer: 2200 });
                    this.getSalida(id);
                } else {
                    app.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo eliminar la evidencia' });
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
            parent:    'kpisRow',
            json:      rows,
            cardClass: 'bg-white rounded-lg border border-gray-200 dark:!border-0 px-3 py-3 cursor-pointer hover:shadow-md transition-shadow',
            onClick:   (kpi) => salidas.lsKpiDetail(kpi)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: () => {}
        });
    }

    kpiDetailModal(options) {
        const defaults = {
            id:       'kpiDetail',
            title:    '',
            value:    '',
            subtitle: '',
            size:     'large',
            center:   [],
            right:    [],
            data:     { row: [] }
        };

        const opts  = Object.assign({}, defaults, options || {});
        const modal = this.cfModal({ title: opts.title, size: opts.size, backdropClose: true });

        // Solo lectura: se cierra con la X, Escape o clic afuera.
        modal.footer.remove();
        modal.body.attr('id', `${opts.id}${this.PROJECT_NAME}`);

        this.createCoffeeTable3({
            parent:       `${opts.id}${this.PROJECT_NAME}`,
            id:           `tb${opts.id}${this.PROJECT_NAME}`,
            theme:        'light',
            title:        opts.value,
            subtitle:     opts.subtitle,
            center:       opts.center,
            right:        opts.right,
            extends:      true,
            scrollable:   false,
            f_size:       12,
            emptyMessage: 'Sin movimientos con los filtros aplicados',
            emptyIcon:    'icon-doc-text',
            data:         opts.data
        });

        if (window.lucide) lucide.createIcons();
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

        const opts   = Object.assign({}, defaults, options || {});
        opts.json    = Object.assign({}, defaults.json,    (options || {}).json    || {});
        opts.classes = Object.assign({}, defaults.classes, (options || {}).classes || {});

        const esc  = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

    salidaDetailPanel(options) {
        const defaults = {
            parent:   'root',
            id:       'salidaDetailPanel',
            class:    'flex-1 min-h-0 flex flex-col overflow-hidden',
            json:     null,
            labels: {
                emptyTitle:  'Selecciona una salida',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de la salida',
                motivo:      'Tipo de salida',
                fecha:       'Fecha',
                sucursal:    'Sucursal',
                almacen:     'Origen',
                registrado:  'Registrado',
                productos:   'Productos',
                perdidaTot:  'Valor de salidas',
                detalleLbl:  'Detalle de Productos',
                notaLbl:     'Nota',
                evidenciaLbl:'Evidencia',
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
                'Merma':                  { bg: '#FEE2E2', fg: '#DC2626', icon: 'trending-down'  },
                'Caducidad':              { bg: 'rgba(190,113,25,0.18)', fg: '#BE7119', icon: 'calendar-x'     },
                'Consumo interno':        { bg: 'var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)))', fg: 'var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)))', icon: 'coffee' },
                'Robo / Faltante':        { bg: '#F3E8FF', fg: '#9333EA', icon: 'shield-alert'   },
                'Producto dañado':        { bg: 'rgba(251,140,0,0.18)',  fg: '#FB8C00', icon: 'alert-triangle' },
                'Devolución a proveedor': { bg: 'rgba(63,193,137,0.18)', fg: '#3FC189', icon: 'rotate-ccw'     },
                'Solicitud':              { bg: 'rgba(14,165,233,0.18)', fg: '#0EA5E9', icon: 'clipboard-list' },
                'Surtido a sucursal':     { bg: '#CCFBF1', fg: '#0D9488', icon: 'truck'         },
                'Pedido complementario':  { bg: '#F1F5F9', fg: '#475569', icon: 'package-plus'  }
            },
            statusPalettes: {
                'Aplicada':  { bg: '#DCFCE7', fg: '#16A34A' },
                'Cancelada': { bg: '#FEE2E2', fg: '#DC2626' }
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

        // Mismo visor que el de entradas (entradaDetailPanel): encabezado con folio,
        // datos, tabla compacta, totales, registro/nota/evidencia y acciones.
        const infoRow = (label, value) => `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(label)}</span>${value}</div>`;

        const actionsBar = (cancelled) => {
            const base = 'flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5';
            const btn  = cancelled
                ? `<button id="${opts.id}_delete" class="${base}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.eliminar)}</button>`
                : `<button id="${opts.id}_cancel" class="${base}"><i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.cancelar)}</button>`;
            return `<div class="px-4 py-3 border-t border-gray-200 dark:!border-0 flex gap-2 flex-shrink-0">${btn}</div>`;
        };

        const emptyView = () => `
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                <i data-lucide="inbox" class="w-10 h-10 text-gray-300 mb-3"></i>
                <p class="text-sm font-semibold text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                <p class="text-xs text-gray-400 mt-1 max-w-[200px]">${esc(opts.labels.emptyHint)}</p>
            </div>
        `;

        const productTable = (m) => {
            const rows = (m.items || []).map((it) => {
                const cu  = Number(it.costo_unit || 0);
                const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * cu;
                return `
                    <tr class="border-b border-gray-100 last:border-b-0 align-top">
                        <td class="!py-1 !pl-2 !pr-2">
                            <p class="text-[11px] font-medium text-gray-700 leading-tight">${esc(it.name)}${it.sku ? ` <span class="text-[10px] font-normal text-gray-400">${esc(it.sku)}</span>` : ''}</p>
                        </td>
                        <td class="!py-1 !px-1 text-right text-[11px] text-gray-500 whitespace-nowrap">${fmtMoney(cu)}</td>
                        <td class="!py-1 !px-1 text-center text-[11px]"><span class="font-semibold text-gray-800">-${it.qty}</span></td>
                        <td class="!py-1 !px-1 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap">-${fmtMoney(sub)}</td>
                        <td class="!py-1 !pl-1 !pr-2 text-center text-[11px] text-gray-500">${esc(it.unidad || '-')}</td>
                    </tr>`;
            }).join('');

            return `
                <div class="rounded-lg overflow-hidden border border-gray-200 dark:!border-0">
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                                <th class="text-left font-semibold text-[10px] !py-1.5 !pl-2 !pr-2">Producto</th>
                                <th class="text-right font-semibold text-[10px] !py-1.5 !px-1">Precio</th>
                                <th class="text-center font-semibold text-[10px] !py-1.5 !px-1">Cant</th>
                                <th class="text-right font-semibold text-[10px] !py-1.5 !px-1">Importe</th>
                                <th class="text-center font-semibold text-[10px] !py-1.5 !pl-1 !pr-2">Unidad</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="5" class="py-2 text-center text-xs text-gray-400">Sin productos</td></tr>'}</tbody>
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
            const items  = m.items || [];
            const totals = items.reduce((acc, it) => {
                const sub = it.costo_total != null ? Number(it.costo_total) : Number(it.qty || 0) * Number(it.costo_unit || 0);
                acc.uds   += Number(it.qty || 0);
                acc.costo += sub;
                return acc;
            }, { uds: 0, costo: 0 });

            const totUds   = m.total_unidades != null ? m.total_unidades : totals.uds;
            const totCosto = m.total_costo    != null ? m.total_costo    : totals.costo;

            const motivoPal   = opts.motivoPalettes[m.motivo];
            const motivoC     = motivoPal || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF', icon: 'alert-triangle' };
            const motivoBg    = m.motivo_bg || (motivoPal ? motivoC.bg : (hexToRgba(m.motivo_color, 0.18) || motivoC.bg));
            const motivoFg    = m.motivo_color || motivoC.fg;
            const motivoIcon  = m.motivo_icon  || motivoC.icon || 'alert-triangle';
            const motivoBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:${motivoBg};color:${motivoFg};"><i data-lucide="${esc(motivoIcon)}" class="w-3 h-3"></i>${esc(m.motivo || '-')}</span>`;

            const stC      = opts.statusPalettes[m.status] || { bg: 'rgba(156,163,175,0.15)', fg: '#9CA3AF' };
            const reg      = m.registrado_por && m.registrado_por.name ? m.registrado_por.name : '-';
            const editable = m.status !== 'Cancelada';
            const fmtUds   = (n) => (Number(n) % 1 === 0) ? String(n) : Number(n).toFixed(2);

            return `
                <div class="flex-1 flex flex-col overflow-hidden">
                    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 dark:!border-0 flex items-center justify-between flex-shrink-0">
                        <div>
                            <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitleLbl)}</p>
                            <p class="text-base font-bold text-gray-800">${esc(m.folio || '-')}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            ${m.status ? `<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:${stC.bg};color:${stC.fg};">${esc(m.status)}</span>` : ''}
                            <button id="${opts.id}_print" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="${esc(opts.labels.imprimir)}">
                                <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                            </button>
                            <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>

                    <div class="px-4 py-3 border-b border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                        ${infoRow(opts.labels.motivo, motivoBadge)}
                        ${infoRow(opts.labels.fecha, `<span class="text-gray-700 text-right">${esc(fmtFecha(m.fecha))}</span>`)}
                        ${infoRow(opts.labels.sucursal, `<span class="text-gray-700 text-right">${esc(m.sucursal || '-')}</span>`)}
                        ${infoRow(opts.labels.almacen, `<span class="text-gray-700 text-right">${esc(m.almacen || '-')}</span>`)}
                    </div>

                    <div id="${opts.id}_scroll" class="flex-1 overflow-y-auto px-4 py-2">
                        <p class="text-xs uppercase tracking-wider text-gray-500 mb-1">${esc(opts.labels.productos)} (${items.length})</p>
                        ${productTable(m)}
                    </div>

                    <div class="cs-visor-totals px-4 py-2.5 border-t border-gray-200 dark:!border-0 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Unidades</span>
                            <span class="font-semibold text-gray-700">-${fmtUds(totUds)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-semibold text-gray-700">Total general</span>
                            <span class="text-lg font-bold text-gray-800">-${fmtMoney(totCosto)}</span>
                        </div>
                    </div>

                    <div class="px-4 py-2.5 border-t border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                        ${infoRow(opts.labels.registrado, `<span class="text-gray-700 text-right">${esc(reg)}</span>`)}
                        ${m.nota ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(opts.labels.notaLbl)}</span><span class="text-gray-700 text-right">${esc(m.nota)}</span></div>` : ''}
                        ${infoRow(opts.labels.evidenciaLbl, fotoHtml(m.foto, editable))}
                    </div>

                    ${actionsBar(!editable)}
                </div>
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
