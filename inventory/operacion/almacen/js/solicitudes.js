let apiOrdenes = 'ctrl/ctrl-ordenes.php';
let app, solicitudes, solicitudesView;

const VIEW_HEADER_SOLICITUDES = {
    title:    'Mis Solicitudes',
    subtitle: 'Pide materiales y da seguimiento a tus solicitudes'
};

$(async () => {

    solicitudesView = new SolicitudesView(apiOrdenes, 'root');
    solicitudes     = new Solicitudes(apiOrdenes, 'root');
    app             = new App(apiOrdenes, 'root');

    await app.init();

});

// App
class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME  = 'solicitudes';
        this.selectedId    = null;
        this.selectedFolio = null;
        this.activeStatus  = '';
        this.dataInit      = {};
    }

    async init() {
        const r = await useFetch({ url: apiOrdenes, data: { opc: 'init' } });
        if (r && r.status === 200) {
            this.dataInit = {
                companies_id: r.companies_id || '',
                branch_id:    r.branch_id    || '',
                user_id:      r.user_id      || '',
                branch_name:  r.branch_name  || '',
                user_name:    r.user_name    || '',
                sucursales:   r.sucursales   || [],
                almacenes:    r.almacenes    || [],
                productos:    r.productos    || []
            };
            if (!this.dataInit.branch_name && this.dataInit.branch_id) {
                const suc = (this.dataInit.sucursales || []).find(s => String(s.id) === String(this.dataInit.branch_id));
                if (suc) this.dataInit.branch_name = suc.valor || suc.name || '';
            }
        } else {
            this.dataInit = {
                companies_id: '',
                branch_id:    '',
                user_id:      '',
                branch_name:  '',
                user_name:    '',
                sucursales:   [],
                almacenes:    [],
                productos:    []
            };
        }
        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderHeader();
        solicitudesView.renderDetail(null);
        solicitudes.lsSolicitudes();
        solicitudes.lsKpis();
        this.checkDeepLink();
    }

    // Abre directo la solicitud cuando se llega con ?id=..&folio=.. (liga compartida).
    checkDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const id     = params.get('id');
        const folio  = params.get('folio') || '';
        if (!id) return;

        if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
            solicitudesView.openMobileDetail(folio, id);
        } else {
            this.selectSolicitud(folio, id);
        }
    }

    renderHeader() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const branchName = this.dataInit.branch_name || '';

        const titleHtml = branchName
            ? `${VIEW_HEADER_SOLICITUDES.title} <span class="font-bold" style="color:#C05A40;">&middot; ${esc(branchName)}</span>`
            : VIEW_HEADER_SOLICITUDES.title;

        solicitudesView.renderHeader(Object.assign({}, VIEW_HEADER_SOLICITUDES, { titleHtml }));
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
                    class: 'hidden md:block px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'hidden md:block px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'hidden md:block p-3 flex-1 min-h-0 overflow-auto bg-white'
                },
                {
                    id:    'mobileTopBar',
                    class: 'md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 pt-3 pb-3 flex-shrink-0'
                },
                {
                    id:    'mobileCards',
                    class: 'md:hidden flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-3 bg-gray-50'
                }
            ]
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'hidden md:flex w-full md:w-[400px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex-col overflow-hidden'
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

        const ini = this.initials(this.dataInit.user_name || '');

        $('#mainPanel').append(`
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 md:hidden" style="background:#C05A40;position:absolute;top:12px;right:16px">${ini}</div>
            <button id="fabNueva"
                class="md:hidden fixed bottom-20 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-40"
                style="background:#C05A40;box-shadow:0 4px 14px rgba(192,90,64,.45)">
                <i data-lucide="plus" class="w-6 h-6"></i>
            </button>
            <div class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 pt-2 pb-5 flex items-center justify-around z-30">
                <button class="flex flex-col items-center gap-0.5 text-gray-400">
                    <i data-lucide="home" class="w-5 h-5"></i>
                    <span class="text-[10px] font-medium">Inicio</span>
                </button>
                <button class="flex flex-col items-center gap-0.5" style="color:#C05A40">
                    <i data-lucide="clipboard-list" class="w-5 h-5"></i>
                    <span class="text-[10px] font-semibold">Mis solicitudes</span>
                </button>
                <button class="flex flex-col items-center gap-0.5 text-gray-400">
                    <i data-lucide="user" class="w-5 h-5"></i>
                    <span class="text-[10px] font-medium">Perfil</span>
                </button>
            </div>
        `);

        $('#mobileTopBar').html(`<div id="statusChipsMobile" class="flex items-center gap-2 overflow-x-auto -mx-4 px-4" style="scrollbar-width:none"></div>`);

        this.buildStatusChips();
        $('#fabNueva').on('click', () => solicitudesView.openSolicitudForm());

        if (window.lucide) lucide.createIcons();
    }

    filterBar() {
        const estados = [
            { id: '',           valor: 'Todos los estados' },
            { id: 'Solicitada', valor: 'Solicitada' },
            { id: 'Aprobada',   valor: 'Aprobada' },
            { id: 'Parcial',    valor: 'En recepcion' },
            { id: 'Recibida',   valor: 'Recibida' },
            { id: 'Rechazada',  valor: 'Rechazada' },
            { id: 'Borrador',   valor: 'Borrador' }
        ];

        const filters = [
            {
                opc:   'input-calendar',
                id:    `calendar${this.PROJECT_NAME}`,
                lbl:   'Rango de fecha:',
                class: 'col-12 col-md-3 col-lg-3'
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     estados
            },
            {
                opc:       'button',
                id:        'btnNuevaSolicitud',
                text:      'Nueva solicitud',
                color_btn: 'invernal',
                class:     'col-12 col-md-3 col-lg-3',
                onClick:   () => solicitudesView.openSolicitudForm()
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
            status:   this.activeStatus || '',
            mine:     1,
            fechaIni: range.fi || '',
            fechaFin: range.ff || ''
        };
    }

    onChangeFilters() {
        const estado = $('#fEstado').val() || '';
        this.activeStatus = estado;
        this.syncChips(estado);
        solicitudes.lsSolicitudes();
    }

    filterByKpi(kpi) {
        const st      = (kpi && kpi.status) || '';
        const current = this.activeStatus || '';
        this.activeStatus = current === st ? '' : st;
        $('#fEstado').val(this.activeStatus);
        this.syncChips(this.activeStatus);
        solicitudes.lsSolicitudes();
    }

    syncChips(activeStatus) {
        $('#statusChipsMobile .chip-status').each(function () {
            const match = String($(this).data('status')) === String(activeStatus);
            $(this).toggleClass('text-white', match)
                   .toggleClass('bg-white text-gray-600 border border-gray-300', !match)
                   .attr('style', match ? 'background:#C05A40' : '');
        });
    }

    initials(name) {
        const parts = (name || '').trim().split(/\s+/);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    buildStatusChips() {
        const statuses = [
            { id: '',           label: 'Todas' },
            { id: 'Solicitada', label: 'Solicitada' },
            { id: 'Aprobada',   label: 'Aprobada' },
            { id: 'Parcial',    label: 'En recepcion' },
            { id: 'Recibida',   label: 'Recibida' },
            { id: 'Rechazada',  label: 'Rechazada' },
            { id: 'Borrador',   label: 'Borrador' }
        ];

        const $c = $('#statusChipsMobile');
        $c.html(statuses.map((s, i) => {
            const active = i === 0;
            const base   = active
                ? 'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white whitespace-nowrap chip-status'
                : 'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-gray-600 border border-gray-300 whitespace-nowrap hover:border-[#C05A40] chip-status';
            const style  = active ? 'style="background:#C05A40"' : '';
            return `<button class="${base}" data-status="${s.id}" ${style}>${s.label}</button>`;
        }).join(''));

        $c.on('click', '.chip-status', function () {
            $c.find('.chip-status').each(function () {
                $(this).removeClass('text-white').addClass('bg-white text-gray-600 border border-gray-300');
                $(this).removeAttr('style');
            });
            $(this).removeClass('bg-white text-gray-600 border border-gray-300').addClass('text-white');
            $(this).attr('style', 'background:#C05A40');
            app.activeStatus = $(this).data('status');
            $('#fEstado').val(app.activeStatus);
            solicitudes.lsSolicitudes();
        });
    }

    selectSolicitud(folio, id) {
        this.selectedFolio = folio;
        this.selectedId    = id;

        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            }).addClass('row-active');
            solicitudes.getOrden(id);
        } else {
            solicitudesView.renderDetail(null);
        }
    }

    // El backend lsOrdenes es compartido y emite onclick="app.selectOrden(...)";
    // en este modulo es alias de selectSolicitud.
    selectOrden(folio, id) {
        this.selectSolicitud(folio, id);
    }
}

// Solicitudes
class Solicitudes extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'solicitudes';
    }

    lsSolicitudes() {
        const f = app.getFilters();

        this.createTable({
            parent:      'tableWrap',
            idFilterBar: 'filterBar',
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            data: {
                opc:    'lsOrdenes',
                mine:   1,
                status: f.status,
                fi:     f.fechaIni,
                ff:     f.fechaFin
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                f_size:       12,
                center:       [3, 4, 5],
                emptyMessage: 'No se encontraron solicitudes con los filtros aplicados',
                emptyIcon:    'icon-clipboard-list'
            }
        });

        this.lsCards();
    }

    async lsCards() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiOrdenes,
            data: { opc: 'lsOrdenes', mine: 1, status: f.status, fi: f.fechaIni, ff: f.fechaFin }
        });
        const rows = (r && r.status === 200 && r.row) ? r.row : [];
        solicitudesView.renderCards(rows);
    }

    async lsKpis() {
        const r = await useFetch({
            url:  apiOrdenes,
            data: { opc: 'showOrdenes', mine: 1 }
        });
        const c = (r && r.status === 200) ? (r.counts || {}) : {};

        const kpiValue = (n) => {
            const v = parseInt(n || 0, 10);
            return v === 0 ? '-' : v;
        };

        const kpis = [
            { id: 'kpiSolicitadas', label: 'Solicitadas',  value: kpiValue(c.total_solicitadas || 0), tone: 'warning', status: 'Solicitada' },
            { id: 'kpiAprobadas',   label: 'Aprobadas',    value: kpiValue(c.total_aprobadas   || 0), tone: 'info',    status: 'Aprobada'   },
            { id: 'kpiEnRecepcion', label: 'En recepcion', value: kpiValue(c.total_parciales   || 0), tone: 'warning', status: 'Parcial'    },
            { id: 'kpiRecibidas',   label: 'Recibidas',    value: kpiValue(c.total_recibidas   || 0), tone: 'success', status: 'Recibida'   }
        ];

        solicitudesView.renderInfoCards(kpis);
    }

    fechaRelativa(fechaStr) {
        if (!fechaStr || typeof moment === 'undefined') return fechaStr;
        const m = moment(fechaStr, ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss']);
        if (!m.isValid()) return fechaStr;
        return m.fromNow();
    }

    async getOrden(id) {
        const r = await useFetch({ url: apiOrdenes, data: { opc: 'getOrden', id: id } });
        if (r && r.status === 200) {
            solicitudesView.renderDetail(this.mapOrdenDetail(r.header || {}, r.detail || []));
        } else {
            solicitudesView.renderDetail(null);
        }
    }

    mapOrdenDetail(h, detail) {
        return {
            id:                 h.id,
            folio:              h.folio,
            status:             h.status,
            status_badge:       h.status_badge        || '',
            supplier_id:        h.supplier_id,
            supplier_name:      h.supplier_name       || '',
            branch_id:          h.branch_id,
            branch_name:        h.branch_name         || '',
            warehouse_id:       h.warehouse_id,
            warehouse_name:     h.warehouse_name      || '',
            date_order:         h.date_order          || '',
            expected_date:      h.expected_date       || '',
            note:               h.note                || '',
            user_name:          h.user_name           || '',
            approved_user_name: h.approved_user_name  || '',
            approved_at:        h.approved_at         || '',
            reject_reason:      h.reject_reason       || '',
            total_products:     parseInt(h.total_products || 0, 10),
            total_units:        Number(h.total_units  || 0),
            productos: (detail || []).map(d => ({
                detailId:          d.id,
                product_id:        d.product_id,
                nombre:            d.product_name,
                sku:               d.sku              || '',
                unit_id:           d.unit_id,
                quantity_ordered:  Number(d.quantity_ordered  || 0),
                quantity_received: Number(d.quantity_received || 0)
            }))
        };
    }
}

// SolicitudesView
class SolicitudesView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'solicitudes';
    }

    renderInfoCards(rows) {
        const current = app.activeStatus || '';
        const match   = rows.find(k => String(k.status || '') === String(current));

        this.kpisRow({
            parent:   'kpisRow',
            id:       'solicitudesKpisGrid',
            json:     rows,
            cols:     4,
            activeId: match ? match.id : null,
            onClick:  (kpi) => app.filterByKpi(kpi)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json:   data
        });
    }

    renderCards(rows) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

        if (!rows.length) {
            $('#mobileCards').html(`
                <div class="py-16 text-center text-gray-400">
                    <i data-lucide="clipboard-list" class="w-10 h-10 mx-auto mb-2 text-gray-300"></i>
                    <p class="text-sm">No se encontraron solicitudes</p>
                </div>`);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const cardsHtml = rows.map(row => {
            const folio   = esc(row.Folio || row.folio || '');
            const idVal   = esc(String(row.id || ''));
            const badge   = row.Estado || '';
            const mats    = parseInt(row.Materiales || row.materiales || 0, 10);
            const preview = esc(row.preview || '');
            const fechaRel = solicitudes.fechaRelativa(row.Fecha || row.fecha || '');

            return `<div class="block bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm cursor-pointer active:scale-[.99] transition-transform"
                        data-folio="${folio}" data-id="${idVal}"
                        onclick="solicitudesView.openMobileDetail('${folio}', '${idVal}')">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-gray-800">${folio}</span>
                        <span class="text-[11px] text-gray-400">${fechaRel}</span>
                    </div>
                    ${badge}
                </div>
                <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-600 truncate flex-1 min-w-0">${preview || '—'}</p>
                    <span class="flex items-center gap-1 text-[11px] text-gray-400 flex-shrink-0 ml-2">
                        <i data-lucide="package" class="w-3.5 h-3.5"></i> ${mats} material${mats !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>`;
        }).join('');

        $('#mobileCards').html(cardsHtml);
        if (window.lucide) lucide.createIcons();
    }

    renderDetail(orden) {
        const isMobileOverlayOpen = $('#mobileDetailOverlay').length > 0;

        if (isMobileOverlayOpen) {
            if (!orden) {
                $('#mobileDetailOverlay').remove();
            } else {
                this.renderMobileDetail(orden);
            }
            return;
        }

        this.solicitudDetailPanel({
            parent:    'detailPanel',
            json:      orden,
            onClose:   () => {
                app.selectedId    = null;
                app.selectedFolio = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            },
            onDuplicate: (o) => this.openSolicitudForm(o),
            onShare:     (o) => this.openShareSheet(o)
        });
    }

    openMobileDetail(folio, id) {
        app.selectedFolio = folio;
        app.selectedId    = id;

        $('#mobileDetailOverlay').remove();

        const $overlay = $(`
            <div id="mobileDetailOverlay" class="md:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
                <div id="mobileDetailContent" class="flex-1 overflow-y-auto pb-20"></div>
                <div id="mobileDetailFooter" class="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-2"></div>
            </div>
        `);
        $('body').append($overlay);
        if (window.lucide) lucide.createIcons();

        solicitudes.getOrden(id);
    }

    renderMobileDetail(orden) {
        const $content = $('#mobileDetailContent');
        const $footer  = $('#mobileDetailFooter');
        if (!$content.length) return;

        $content.html(this.buildMobileDetailHtml(orden));
        $footer.html(`
            <button id="mobileDetailBack" class="flex-1 px-3.5 py-2.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg flex items-center justify-center gap-1.5">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Volver
            </button>
            <button id="mobileDetailShare" class="flex-1 px-3.5 py-2.5 text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-1.5" style="background:#25D366">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> Compartir
            </button>
            <button id="mobileDetailDuplicate" class="flex-1 px-3.5 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border" style="border-color:#C05A40;color:#C05A40">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Duplicar
            </button>
        `);

        if (window.lucide) lucide.createIcons();

        $('#mobileDetailBack').on('click', () => { $('#mobileDetailOverlay').remove(); });
        $('#mobileDetailShare').on('click', () => { this.openShareSheet(orden); });
        $('#mobileDetailDuplicate').on('click', () => {
            $('#mobileDetailOverlay').remove();
            this.openSolicitudForm(orden);
        });
    }

    buildSystemLink(e) {
        const base   = window.location.origin + window.location.pathname;
        const params = [];
        if (e.id)    params.push('id='    + encodeURIComponent(e.id));
        if (e.folio) params.push('folio=' + encodeURIComponent(e.folio));
        return base + (params.length ? '?' + params.join('&') : '');
    }

    buildShareText(e, includeLink = true) {
        const fmtNum    = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const productos = e.productos || [];
        const totUds    = productos.reduce((s, p) => s + Number(p.quantity_ordered || 0), 0);

        const lines = [];
        lines.push(`*Solicitud ${e.folio || '-'}*`);
        if (e.status)         lines.push(`Estado: ${e.status}`);
        if (e.date_order)     lines.push(`Fecha: ${e.date_order}`);
        if (e.branch_name)    lines.push(`Sucursal: ${e.branch_name}`);
        if (e.warehouse_name) lines.push(`Almacen destino: ${e.warehouse_name}`);
        if (e.user_name)      lines.push(`Solicitado por: ${e.user_name}`);
        lines.push('');
        lines.push('*Materiales:*');
        if (productos.length) {
            productos.forEach((p, i) => {
                const sku = p.sku ? ` (${p.sku})` : '';
                lines.push(`${i + 1}. ${p.nombre}${sku} — ${fmtNum(p.quantity_ordered)}`);
            });
        } else {
            lines.push('Sin materiales');
        }
        lines.push('');
        lines.push(`Total: ${productos.length} material${productos.length !== 1 ? 'es' : ''} · ${fmtNum(totUds)} unidades`);

        if (includeLink) {
            const link = this.buildSystemLink(e);
            if (link) {
                lines.push('');
                lines.push(`Ver en el sistema: ${link}`);
            }
        }
        return lines.join('\n');
    }

    // Hoja de seleccion: deja elegir entre compartir un mensaje de texto
    // (con la liga al sistema) o generar un comprobante tipo ticket.
    openShareSheet(e) {
        if (!e) return;
        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const modalId  = 'modalShareSolicitud';
        const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
        $(`#${modalId}`).remove();

        // "Enviar mensaje" (WhatsApp) solo en movil; en escritorio se oculta.
        const msgBtn = isMobile ? `
                        <button id="${modalId}_msg" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#25D366] hover:bg-green-50/40 transition-all text-left">
                            <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style="background:#25D366"><i data-lucide="message-circle" class="w-5 h-5"></i></span>
                            <span class="min-w-0 flex-1">
                                <span class="block text-sm font-semibold text-gray-800">Enviar mensaje</span>
                                <span class="block text-[11px] text-gray-500">Resumen de texto con la liga del sistema</span>
                            </span>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 flex-shrink-0"></i>
                        </button>` : '';

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] bg-black/45 flex items-end md:items-center justify-center p-0 md:p-4">
                <div class="w-full md:max-w-[380px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                        <div>
                            <h3 class="text-sm font-bold text-gray-800">Compartir solicitud</h3>
                            <p class="text-[11px] text-gray-500">${esc(e.folio || '')}</p>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="p-4 space-y-3">
                        ${msgBtn}
                        <button id="${modalId}_doc" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#C05A40] hover:bg-orange-50/40 transition-all text-left">
                            <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style="background:#C05A40"><i data-lucide="receipt" class="w-5 h-5"></i></span>
                            <span class="min-w-0 flex-1">
                                <span class="block text-sm font-semibold text-gray-800">Enviar ticket</span>
                                <span class="block text-[11px] text-gray-500">Comprobante en imagen, listo para mandar por chat</span>
                            </span>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 flex-shrink-0"></i>
                        </button>
                        <button id="${modalId}_print" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all text-left">
                            <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style="background:#374151"><i data-lucide="printer" class="w-5 h-5"></i></span>
                            <span class="min-w-0 flex-1">
                                <span class="block text-sm font-semibold text-gray-800">Imprimir / PDF</span>
                                <span class="block text-[11px] text-gray-500">Abre el ticket para imprimirlo o guardarlo como PDF</span>
                            </span>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 flex-shrink-0"></i>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const close = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', close);
        $modal.on('click', (ev) => { if ($(ev.target).is(`#${modalId}`)) close(); });
        if (isMobile) $(`#${modalId}_msg`).on('click', () => { close(); this.shareMessage(e); });
        $(`#${modalId}_doc`).on('click',   () => { close(); this.shareDocument(e); });
        $(`#${modalId}_print`).on('click', () => { close(); this.printDocument(e); });
    }

    async shareMessage(e) {
        const link = this.buildSystemLink(e);

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Solicitud ${e.folio || ''}`,
                    text:  this.buildShareText(e, false),
                    url:   link
                });
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }
        window.open('https://wa.me/?text=' + encodeURIComponent(this.buildShareText(e, true)), '_blank');
    }

    // Dibuja el ticket en un <canvas> (sin librerias) y devuelve el elemento.
    // Doble pasada: la primera mide la altura, la segunda pinta.
    buildTicketCanvas(e) {
        const fmtNum    = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const productos = e.productos || [];
        const totUds    = productos.reduce((s, p) => s + Number(p.quantity_ordered || 0), 0);
        const link      = this.buildSystemLink(e);

        const SCALE = 2;
        const W     = 380;
        const padX  = 26;
        const cw    = W - padX * 2;

        const TERRA = '#C05A40', INK = '#111111', GRAY = '#6b7280', SOFT = '#9ca3af', LINEC = '#e5e7eb', DASH = '#d1d5db';
        const F = {
            brand: '800 26px "Segoe UI", Arial', sub: '12px "Segoe UI", Arial',
            folio: '800 30px "Segoe UI", Arial', badge: '700 11px "Segoe UI", Arial',
            label: '12px "Segoe UI", Arial', value: '700 12px "Segoe UI", Arial',
            th:    '700 11px "Segoe UI", Arial', td: '12px "Segoe UI", Arial',
            tdb:   '700 12px "Segoe UI", Arial', sku: '10px "Segoe UI", Arial',
            total: '800 15px "Segoe UI", Arial', linkLbl: '10px "Segoe UI", Arial',
            link:  '11px "Segoe UI", Arial', foot: '10px "Segoe UI", Arial', empty: 'italic 12px "Segoe UI", Arial'
        };

        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');

        const wrap = (text, font, maxW) => {
            ctx.font = font;
            const words = String(text || '').split(/\s+/);
            const lines = [];
            let cur = '';
            for (const w of words) {
                const t = cur ? cur + ' ' + w : w;
                if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
                else cur = t;
            }
            if (cur) lines.push(cur);
            return lines.length ? lines : [''];
        };

        const info = [
            ['Fecha', e.date_order], ['Sucursal', e.branch_name], ['Almacen destino', e.warehouse_name],
            ['Solicitado por', e.user_name], ['Proveedor', e.supplier_name]
        ].filter(r => r[1]);

        const idxX  = padX, nameX = padX + 20, nameW = cw - 20 - 46;

        const pass = (draw) => {
            const hline = (yy, color, lw) => { if (!draw) return; ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(padX, yy); ctx.lineTo(W - padX, yy); ctx.stroke(); };
            const dash  = (yy, color, lw) => { if (!draw) return; ctx.strokeStyle = color || DASH; ctx.lineWidth = lw || 1; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(padX, yy); ctx.lineTo(W - padX, yy); ctx.stroke(); ctx.setLineDash([]); };

            let y = 26;

            if (draw) { ctx.textAlign = 'center'; ctx.fillStyle = TERRA; ctx.font = F.brand; ctx.fillText('HUUBIE', W / 2, y + 18); }
            y += 30;
            if (draw) { ctx.fillStyle = GRAY; ctx.font = F.sub; ctx.fillText('Solicitud de materiales', W / 2, y); }
            y += 16;
            dash(y, DASH, 2); y += 22;

            if (draw) { ctx.fillStyle = INK; ctx.font = F.folio; ctx.textAlign = 'center'; ctx.fillText(e.folio || '-', W / 2, y + 8); }
            y += 30;
            if (e.status) {
                const label = String(e.status).toUpperCase();
                ctx.font = F.badge;
                const bw = ctx.measureText(label).width + 26;
                if (draw) {
                    const bx = (W - bw) / 2;
                    ctx.strokeStyle = TERRA; ctx.lineWidth = 1; ctx.setLineDash([]);
                    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, y - 4, bw, 20, 10); ctx.stroke(); }
                    else { ctx.strokeRect(bx, y - 4, bw, 20); }
                    ctx.fillStyle = TERRA; ctx.textAlign = 'center'; ctx.fillText(label, W / 2, y + 10);
                }
                y += 26;
            }
            y += 8;

            info.forEach(([k, v]) => {
                if (draw) {
                    ctx.textAlign = 'left';  ctx.fillStyle = GRAY; ctx.font = F.label; ctx.fillText(k, padX, y + 4);
                    ctx.textAlign = 'right'; ctx.fillStyle = INK;  ctx.font = F.value; ctx.fillText(String(v), W - padX, y + 4);
                }
                y += 18;
                dash(y - 6, LINEC, 1);
            });
            y += 10;

            if (draw) {
                ctx.textAlign = 'left'; ctx.fillStyle = GRAY; ctx.font = F.th;
                ctx.fillText('#', idxX, y); ctx.fillText('MATERIAL', nameX, y);
                ctx.textAlign = 'right'; ctx.fillText('CANT', W - padX, y);
            }
            y += 6; hline(y, INK, 1.5); y += 14;

            if (productos.length) {
                productos.forEach((p, i) => {
                    const nameLines = wrap(p.nombre, F.td, nameW);
                    const skuLines  = p.sku ? wrap(p.sku, F.sku, nameW) : [];
                    const rowH      = nameLines.length * 15 + skuLines.length * 12 + 8;
                    if (draw) {
                        ctx.textAlign = 'left'; ctx.fillStyle = SOFT; ctx.font = F.td; ctx.fillText(String(i + 1), idxX, y + 10);
                        ctx.fillStyle = INK; ctx.font = F.td;
                        let ny = y + 10;
                        nameLines.forEach(l => { ctx.fillText(l, nameX, ny); ny += 15; });
                        if (skuLines.length) { ctx.fillStyle = SOFT; ctx.font = F.sku; skuLines.forEach(l => { ctx.fillText(l, nameX, ny); ny += 12; }); }
                        ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = F.tdb; ctx.fillText(fmtNum(p.quantity_ordered), W - padX, y + 10);
                    }
                    y += rowH;
                    dash(y - 4, LINEC, 1);
                });
            } else {
                if (draw) { ctx.textAlign = 'center'; ctx.fillStyle = SOFT; ctx.font = F.empty; ctx.fillText('Sin materiales', W / 2, y + 6); }
                y += 22;
            }
            y += 10; dash(y - 6, DASH, 2);

            if (draw) {
                ctx.textAlign = 'left';  ctx.fillStyle = INK; ctx.font = F.total; ctx.fillText('Total', padX, y + 8);
                ctx.textAlign = 'right'; ctx.fillText(`${productos.length} item${productos.length !== 1 ? 's' : ''} · ${fmtNum(totUds)} uds`, W - padX, y + 8);
            }
            y += 24;

            if (link) {
                dash(y - 6, LINEC, 1);
                if (draw) { ctx.textAlign = 'center'; ctx.fillStyle = GRAY; ctx.font = F.linkLbl; ctx.fillText('VER EN EL SISTEMA', W / 2, y + 4); }
                y += 16;
                wrap(link, F.link, cw).forEach(l => {
                    if (draw) { ctx.textAlign = 'center'; ctx.fillStyle = TERRA; ctx.font = F.link; ctx.fillText(l, W / 2, y + 4); }
                    y += 14;
                });
            }
            y += 14;
            if (draw) { ctx.textAlign = 'center'; ctx.fillStyle = SOFT; ctx.font = F.foot; ctx.fillText('Huubie · Inventarios · Comprobante de solicitud', W / 2, y); }
            y += 18;

            return y;
        };

        const H = Math.ceil(pass(false));

        canvas.width  = W * SCALE;
        canvas.height = H * SCALE;
        ctx.scale(SCALE, SCALE);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.textBaseline = 'alphabetic';
        pass(true);

        return canvas;
    }

    shareDocument(e) {
        const canvas   = this.buildTicketCanvas(e);
        const safeFolio = String(e.folio || 'ticket').replace(/[^\w.-]+/g, '_');
        const fileName  = `Solicitud-${safeFolio}.png`;

        canvas.toBlob(async (blob) => {
            if (!blob) {
                this.alertBox({ type: 'error', title: 'No se pudo generar el ticket' });
                return;
            }

            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Solicitud ${e.folio || ''}`,
                        text:  this.buildShareText(e, true)
                    });
                    return;
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                }
            }

            // Sin Web Share de archivos (escritorio): descarga la imagen para adjuntarla.
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);

            this.alertBox({
                type:       'success',
                title:      'Ticket generado',
                detailHtml: 'Se descargo la imagen del ticket para que la adjuntes en tu chat.',
                timer:      2600
            });
        }, 'image/png');
    }

    printDocument(e) {
        const esc    = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);

        const productos = e.productos || [];
        const totUds    = productos.reduce((s, p) => s + Number(p.quantity_ordered || 0), 0);
        const link      = this.buildSystemLink(e);

        const rowsHtml = productos.length
            ? productos.map((p, i) => `
                <tr>
                    <td class="idx">${i + 1}</td>
                    <td class="prod">${esc(p.nombre)}${p.sku ? `<span class="sku">${esc(p.sku)}</span>` : ''}</td>
                    <td class="qty">${fmtNum(p.quantity_ordered)}</td>
                </tr>`).join('')
            : `<tr><td colspan="3" class="empty">Sin materiales</td></tr>`;

        const infoRow = (k, v) => v ? `<div class="info"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : '';

        const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Solicitud ${esc(e.folio || '')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI', Arial, sans-serif; background:#e5e7eb; color:#111; padding:18px; }
  .toolbar { width:360px; max-width:100%; margin:0 auto 14px; display:flex; gap:8px; justify-content:flex-end; }
  .btn { cursor:pointer; border:0; border-radius:8px; padding:9px 16px; font-size:13px; font-weight:700; color:#fff; }
  .btn.print { background:#C05A40; } .btn.close { background:#6b7280; }
  .ticket { width:360px; max-width:100%; margin:0 auto; background:#fff; border-radius:10px; padding:22px 22px 18px; box-shadow:0 4px 18px rgba(0,0,0,.18); }
  .brand { text-align:center; border-bottom:2px dashed #d1d5db; padding-bottom:12px; margin-bottom:12px; }
  .brand h1 { font-size:18px; letter-spacing:1px; color:#C05A40; }
  .brand p { font-size:11px; color:#6b7280; margin-top:2px; }
  .folio { text-align:center; margin-bottom:12px; }
  .folio .f { font-size:22px; font-weight:800; }
  .folio .st { display:inline-block; margin-top:4px; font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 10px; border:1px solid #C05A40; color:#C05A40; border-radius:20px; }
  .info { display:flex; justify-content:space-between; font-size:12px; padding:3px 0; border-bottom:1px dotted #e5e7eb; }
  .info span { color:#6b7280; } .info b { font-weight:700; text-align:right; }
  table { width:100%; border-collapse:collapse; margin-top:12px; }
  thead th { font-size:10px; text-transform:uppercase; color:#6b7280; border-bottom:1.5px solid #111; padding:5px 4px; text-align:left; }
  thead th.qty { text-align:center; } thead th.idx { width:22px; }
  tbody td { font-size:12px; padding:5px 4px; border-bottom:1px dotted #e5e7eb; vertical-align:top; }
  tbody td.idx { color:#9ca3af; } tbody td.qty { text-align:center; font-weight:700; }
  .prod .sku { display:block; font-size:10px; color:#9ca3af; }
  .empty { text-align:center; color:#9ca3af; font-style:italic; }
  .total { display:flex; justify-content:space-between; margin-top:12px; padding-top:10px; border-top:2px dashed #d1d5db; font-size:14px; font-weight:800; }
  .link { margin-top:14px; padding-top:12px; border-top:1px dotted #e5e7eb; text-align:center; }
  .link p { font-size:10px; color:#6b7280; margin-bottom:4px; text-transform:uppercase; letter-spacing:.5px; }
  .link a { font-size:11px; color:#C05A40; word-break:break-all; }
  .foot { text-align:center; font-size:10px; color:#9ca3af; margin-top:12px; }
  @media print { body { background:#fff; padding:0; } .toolbar { display:none; } .ticket { box-shadow:none; width:auto; border-radius:0; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="btn print" onclick="window.print()">Imprimir / PDF</button>
    <button class="btn close" onclick="window.close()">Cerrar</button>
  </div>
  <div class="ticket">
    <div class="brand">
      <h1>HUUBIE</h1>
      <p>Solicitud de materiales</p>
    </div>
    <div class="folio">
      <div class="f">${esc(e.folio || '-')}</div>
      ${e.status ? `<span class="st">${esc(e.status)}</span>` : ''}
    </div>
    <div>
      ${infoRow('Fecha', e.date_order)}
      ${infoRow('Sucursal', e.branch_name)}
      ${infoRow('Almacen destino', e.warehouse_name)}
      ${infoRow('Solicitado por', e.user_name)}
      ${infoRow('Proveedor', e.supplier_name)}
    </div>
    <table>
      <thead>
        <tr><th class="idx">#</th><th>Material</th><th class="qty">Cant</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="total">
      <span>Total</span>
      <span>${productos.length} item${productos.length !== 1 ? 's' : ''} &middot; ${fmtNum(totUds)} uds</span>
    </div>
    ${link ? `<div class="link"><p>Ver en el sistema</p><a href="${esc(link)}">${esc(link)}</a></div>` : ''}
    <div class="foot">Huubie &middot; Inventarios &middot; Comprobante de solicitud</div>
  </div>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=420,height=760');
        if (!w) {
            this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para ver el documento.' });
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    buildMobileDetailHtml(e) {
        const esc    = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const status = e.status || '';

        const productosHtml = (e.productos || []).map(p => {
            const recibido = p.quantity_received;
            const ordenado = p.quantity_ordered;
            const completo = recibido >= ordenado && ordenado > 0;
            const parcial  = recibido > 0 && recibido < ordenado;
            const showRecv = ['Parcial', 'Recibida', 'Aprobada'].includes(status);

            let recvLabel, recvColor, recvIcon;
            if (completo) {
                recvLabel = `Recibido ${fmtNum(recibido)} de ${fmtNum(ordenado)}`;
                recvColor = '#22c55e';
                recvIcon  = 'check-circle-2';
            } else if (parcial) {
                recvLabel = `Recibido ${fmtNum(recibido)} de ${fmtNum(ordenado)}`;
                recvColor = '#f97316';
                recvIcon  = 'loader';
            } else {
                recvLabel = `Recibido 0 de ${fmtNum(ordenado)}`;
                recvColor = '#9ca3af';
                recvIcon  = 'circle';
            }

            return `
                <div class="px-3.5 py-3 border-b border-gray-100 last:border-0">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-800 truncate">${esc(p.nombre)}</p>
                            ${p.sku ? `<p class="text-[11px] text-gray-400">${esc(p.sku)}</p>` : ''}
                        </div>
                        <div class="text-right flex-shrink-0">
                            <p class="text-sm font-bold text-gray-800">${fmtNum(ordenado)}</p>
                            <p class="text-[10px] text-gray-400">pedido</p>
                        </div>
                    </div>
                    ${showRecv ? `
                    <div class="mt-2 flex items-center gap-1.5">
                        <i data-lucide="${recvIcon}" class="w-3.5 h-3.5" style="color:${recvColor}"></i>
                        <span class="text-[11px] font-semibold" style="color:${recvColor}">${recvLabel}</span>
                    </div>` : ''}
                </div>`;
        }).join('');

        const totUds = (e.productos || []).reduce((s, p) => s + p.quantity_ordered,  0);
        const totRcv = (e.productos || []).reduce((s, p) => s + p.quantity_received, 0);

        return `
            <div class="sticky top-0 z-30 bg-white border-b border-gray-200 px-3 py-3 flex items-center gap-2 flex-shrink-0">
                <button id="mobileDetailBackTop" class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <h1 class="text-base font-bold text-gray-800 flex-1">${esc(e.folio || '-')}</h1>
                ${e.status_badge || `<span class="px-2.5 py-1 rounded text-[11px] font-bold bg-gray-100 text-gray-500">${esc(status)}</span>`}
            </div>

            <div class="px-4 pt-4 space-y-4 pb-4">

                ${(status === 'Rechazada' && e.reject_reason) ? `
                <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div class="flex items-start gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white flex-shrink-0">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-red-700">Motivo de rechazo</p>
                            <p class="text-xs text-red-600 mt-0.5 leading-relaxed">${esc(e.reject_reason)}</p>
                        </div>
                    </div>
                </div>` : ''}

                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3.5">Seguimiento</p>
                    ${this.buildMobileStepper(status)}
                </div>

                <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
                    ${e.user_name ? `
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> Solicitado por</span>
                        <span class="text-gray-800 font-medium text-right">${esc(e.user_name)}</span>
                    </div><div class="h-px bg-gray-100"></div>` : ''}
                    ${e.date_order ? `
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> Fecha</span>
                        <span class="text-gray-800 font-medium text-right">${esc(e.date_order)}</span>
                    </div><div class="h-px bg-gray-100"></div>` : ''}
                    ${e.branch_name ? `
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i> Sucursal</span>
                        <span class="text-gray-800 font-medium text-right">${esc(e.branch_name)}</span>
                    </div>` : ''}
                    ${e.warehouse_name ? `<div class="h-px bg-gray-100"></div>
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="warehouse" class="w-3.5 h-3.5"></i> Almacen destino</span>
                        <span class="text-gray-800 font-medium text-right">${esc(e.warehouse_name)}</span>
                    </div>` : ''}
                    ${e.supplier_name ? `<div class="h-px bg-gray-100"></div>
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="truck" class="w-3.5 h-3.5"></i> Proveedor</span>
                        <span class="text-gray-800 font-medium text-right">${esc(e.supplier_name)}</span>
                    </div>` : ''}
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <label class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Materiales pedidos</label>
                        <span class="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">${(e.productos || []).length}</span>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        ${productosHtml || '<div class="px-3.5 py-4 text-xs text-gray-400 italic text-center">Sin materiales</div>'}
                    </div>
                </div>

                <div class="text-xs text-gray-500 flex items-center justify-between px-1">
                    <span>${(e.productos || []).length} material${(e.productos || []).length !== 1 ? 'es' : ''} &middot; ${fmtNum(totUds)} unidades pedidas</span>
                    ${totRcv > 0 ? `<span class="font-semibold" style="color:#C05A40">${fmtNum(totRcv)} recibidas</span>` : ''}
                </div>
            </div>
        `;
    }

    solicitudDetailPanel(options) {
        const defaults = {
            parent:    'detailPanel',
            id:        'solicitudDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-white flex flex-col overflow-hidden',
            json:      null,
            labels: {
                emptyTitle:    'Selecciona una solicitud',
                emptyHint:     'Haz click en una fila para ver el seguimiento completo aqui.',
                subtitle:      'Seguimiento de solicitud',
                solicitadoPor: 'Solicitado por',
                fecha:         'Fecha',
                sucursal:      'Sucursal',
                almacen:       'Almacen destino',
                proveedor:     'Proveedor',
                aprobadoPor:   'Aprobado por',
                nota:          'Nota',
                materiales:    'Materiales',
                pedido:        'Pedido',
                recibido:      'Recibido',
                duplicar:      'Duplicar solicitud',
                compartir:     'Compartir',
                cerrar:        'Cerrar'
            },
            estadoPalettes: {
                'Borrador':   { bg: 'rgba(156,163,175,0.15)', fg: '#9CA3AF' },
                'Solicitada': { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Aprobada':   { bg: 'rgba(59,130,246,0.15)',  fg: '#3B82F6' },
                'Parcial':    { bg: 'rgba(251,146,60,0.15)',  fg: '#FB923C' },
                'Recibida':   { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Rechazada':  { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' },
                'Cancelada':  { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            onClose:     () => {},
            onDuplicate: () => {},
            onShare:     () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});

        const esc    = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmtNum = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);

        const aside = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="px-3 py-3 flex-shrink-0 bg-gray-50 border-b border-gray-200">
                    <h3 class="text-sm font-bold text-gray-800">Detalle solicitud</h3>
                    <p class="text-[10px] text-gray-500">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <i data-lucide="clipboard-list" class="w-6 h-6 text-gray-400"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-gray-400 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>`);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e      = opts.json;
        const status = e.status || '';

        const estadoC     = opts.estadoPalettes[status] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
        const estadoBadge = e.status_badge
            ? e.status_badge
            : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(status)}</span>`;

        const stepperHtml = this.buildStepper(status);

        const rejectHtml = (status === 'Rechazada' && e.reject_reason)
            ? `<div class="mx-3 my-2 rounded-lg px-3 py-2.5" style="border-left:3px solid #E02424;background:rgba(224,36,36,.07)">
                   <p class="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style="color:#E02424">Motivo del rechazo</p>
                   <p class="text-xs text-gray-700">${esc(e.reject_reason)}</p>
               </div>`
            : '';

        const productosTableHtml = () => {
            const showRecv = ['Parcial', 'Recibida', 'Aprobada'].includes(status);
            const items    = e.productos || [];
            const totUds   = items.reduce((s, p) => s + p.quantity_ordered,  0);
            const totRcv   = items.reduce((s, p) => s + p.quantity_received, 0);

            const rows = items.map(p => {
                const ordenado = p.quantity_ordered;
                const recibido = p.quantity_received;
                const completo = recibido >= ordenado && ordenado > 0;
                const parcial  = recibido > 0 && recibido < ordenado;

                let recvColor = '#9ca3af', recvIcon = 'circle';
                if (completo)      { recvColor = '#22c55e'; recvIcon = 'check-circle-2'; }
                else if (parcial)  { recvColor = '#f97316'; recvIcon = 'loader'; }

                return `
                    <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td class="py-2 px-2">
                            <p class="text-[10px] font-bold text-gray-800 leading-tight truncate">${esc(p.nombre)}</p>
                            ${p.sku ? `<p class="text-[9px] text-gray-400">${esc(p.sku)}</p>` : ''}
                        </td>
                        <td class="py-2 px-2 text-center font-bold text-blue-600 whitespace-nowrap text-[10px]">${fmtNum(ordenado)}</td>
                        ${showRecv ? `
                        <td class="py-2 px-2 text-right whitespace-nowrap text-[10px]">
                            <div class="flex items-center justify-end gap-1">
                                <i data-lucide="${recvIcon}" class="w-3 h-3 flex-shrink-0" style="color:${recvColor}"></i>
                                <span class="font-semibold" style="color:${recvColor}">${fmtNum(recibido)}</span>
                            </div>
                        </td>` : ''}
                    </tr>`;
            }).join('');

            const foot = items.length ? `
                <tfoot>
                    <tr class="border-t border-gray-200">
                        <td class="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Total</td>
                        <td class="py-2.5 px-2 text-center font-bold text-blue-600 whitespace-nowrap">${fmtNum(totUds)}</td>
                        ${showRecv ? `<td class="py-2.5 px-2 text-right text-[11px] font-bold whitespace-nowrap" style="color:#C05A40">${totRcv > 0 ? fmtNum(totRcv) + ' rcv' : ''}</td>` : ''}
                    </tr>
                </tfoot>` : '';

            return `
                <div class="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${esc(opts.labels.materiales)}</p>
                        <p class="text-[10px] text-gray-400">${items.length} tipo${items.length !== 1 ? 's' : ''} &middot; ${fmtNum(totUds)} uds</p>
                    </div>
                    <table class="w-full text-[11px] border-collapse">
                        <thead>
                            <tr class="text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                <th class="py-2 px-2 text-left font-bold">Producto</th>
                                <th class="py-2 px-2 text-center font-bold w-16">${esc(opts.labels.pedido)}</th>
                                ${showRecv ? `<th class="py-2 px-2 text-right font-bold w-20">${esc(opts.labels.recibido)}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="${showRecv ? 3 : 2}" class="py-2 text-center text-[11px] text-gray-400 italic">Sin materiales</td></tr>`}</tbody>
                        ${foot}
                    </table>
                </div>`;
        };

        aside.html(`
            <div class="px-3 py-3 flex-shrink-0 flex items-center justify-between bg-gray-50 border-b border-gray-200">
                <div>
                    <h3 class="text-sm font-bold text-gray-800">Solicitud ${esc(e.folio || '-')}</h3>
                    <p class="text-[10px] text-gray-500">${esc(e.date_order || '')}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${estadoBadge}
                    <button id="${opts.id}_close" class="text-gray-500 hover:text-gray-700 transition-colors p-1" title="${esc(opts.labels.cerrar)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            ${stepperHtml}

            ${rejectHtml}

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-3">

                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5">
                    ${e.user_name          ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.solicitadoPor)}</span><span class="font-medium text-gray-700">${esc(e.user_name)}</span></div>` : ''}
                    ${e.date_order         ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.fecha)}</span><span class="text-gray-700">${esc(e.date_order)}</span></div>` : ''}
                    ${e.branch_name        ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.sucursal)}</span><span class="font-medium text-gray-700">${esc(e.branch_name)}</span></div>` : ''}
                    ${e.warehouse_name     ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.almacen)}</span><span class="font-medium text-gray-700">${esc(e.warehouse_name)}</span></div>` : ''}
                    ${e.supplier_name      ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.proveedor)}</span><span class="font-medium text-gray-700">${esc(e.supplier_name)}</span></div>` : ''}
                    ${e.approved_user_name ? `<div class="flex justify-between text-[11px]"><span class="text-gray-500">${esc(opts.labels.aprobadoPor)}</span><span class="font-medium text-gray-700">${esc(e.approved_user_name)}</span></div>` : ''}
                </div>

                ${productosTableHtml()}

                ${e.note ? `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">${esc(opts.labels.nota)}</p>
                    <p class="text-[11px] text-gray-600">${esc(e.note)}</p>
                </div>` : ''}

            </div>

            <div class="px-3 py-3 flex-shrink-0 border-t border-gray-200 flex gap-2">
                <button id="${opts.id}_share" class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity" style="background:#25D366">
                    <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> ${esc(opts.labels.compartir)}
                </button>
                <button id="${opts.id}_duplicate" class="flex-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity" style="border-color:#C05A40;color:#C05A40">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i> ${esc(opts.labels.duplicar)}
                </button>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(e));
        $(`#${opts.id}_share`).on('click', () => opts.onShare(e));
        $(`#${opts.id}_duplicate`).on('click', () => opts.onDuplicate(e));
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

    buildStepper(status) {
        const steps           = ['Borrador', 'Solicitada', 'Aprobada', 'Parcial', 'Recibida'];
        const specialStatuses = ['Rechazada', 'Cancelada'];
        const isSpecial       = specialStatuses.includes(status);
        const activeIdx       = isSpecial ? -1 : steps.indexOf(status);

        if (isSpecial) {
            return `<div class="flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-200 flex-shrink-0 bg-gray-50">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded" style="background:rgba(224,36,36,.12);color:#E02424">${status.toUpperCase()}</span>
                    </div>`;
        }

        const stepsHtml = steps.map((s, i) => {
            const done    = i < activeIdx;
            const current = i === activeIdx;
            const dotBg   = (done || current) ? '#C05A40' : '#fff';
            const dotBd   = (done || current) ? '#C05A40' : '#D1D5DB';
            const lColor  = current ? '#C05A40' : (done ? '#6B7280' : '#9CA3AF');
            const lineBg  = done ? '#C05A40' : '#E5E7EB';
            return `
                <div class="flex items-center flex-shrink-0">
                    <div class="flex flex-col items-center">
                        <div class="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style="background:${dotBg};border-color:${dotBd}"></div>
                        <p class="text-[9px] font-semibold mt-0.5 whitespace-nowrap" style="color:${lColor}">${s}</p>
                    </div>
                    ${i < steps.length - 1 ? `<div class="h-0.5 w-6 flex-shrink-0 mb-3" style="background:${lineBg}"></div>` : ''}
                </div>`;
        }).join('');

        return `<div class="flex items-center gap-0 px-3 py-2.5 border-b border-gray-200 flex-shrink-0 bg-gray-50 overflow-x-auto">${stepsHtml}</div>`;
    }

    buildMobileStepper(status) {
        const specialStatuses = ['Rechazada', 'Cancelada'];
        const isSpecial = specialStatuses.includes(status);

        const stepDefs = [
            { key: 'Solicitada', icon: 'send',          label: 'Solicitada' },
            { key: 'Aprobada',   icon: 'check',         label: 'Aprobada' },
            { key: 'Parcial',    icon: 'truck',         label: 'En recepcion' },
            { key: 'Recibida',   icon: 'package-check', label: 'Recibida' }
        ];

        const order  = ['Borrador', 'Solicitada', 'Aprobada', 'Parcial', 'Recibida'];
        const curIdx = isSpecial ? 1 : order.indexOf(status);

        return stepDefs.map((step, i) => {
            const stepIdx = order.indexOf(step.key);
            const done    = stepIdx < curIdx;
            const current = stepIdx === curIdx && !isSpecial;
            const isRej   = isSpecial && i === 0;
            const isLast  = i === stepDefs.length - 1;

            let dotBg = '#f3f4f6', dotBd = '#d1d5db', iconColor = '#9ca3af', labelCls = 'text-sm font-semibold text-gray-400', sublabel = 'Pendiente';
            let lineBg = '#e5e7eb';

            if (done) {
                dotBg = '#22c55e'; dotBd = '#22c55e'; iconColor = '#fff'; labelCls = 'text-sm font-semibold text-gray-800'; sublabel = '';
                lineBg = '#22c55e';
            } else if (current) {
                dotBg = '#f97316'; dotBd = '#f97316'; iconColor = '#fff'; labelCls = 'text-sm font-bold text-orange-600'; sublabel = 'En curso';
            } else if (isRej) {
                dotBg = '#ef4444'; dotBd = '#ef4444'; iconColor = '#fff'; labelCls = 'text-sm font-bold text-red-600'; sublabel = status;
            }

            return `
                <div class="flex gap-3">
                    <div class="flex flex-col items-center">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 ${current ? 'ring-4 ring-orange-100' : ''}" style="background:${dotBg};border:2px solid ${dotBd}">
                            ${done ? `<i data-lucide="check" class="w-4 h-4" style="color:#fff"></i>` : `<i data-lucide="${step.icon}" class="w-4 h-4" style="color:${iconColor}"></i>`}
                        </div>
                        ${!isLast ? `<div class="w-0.5 flex-1 my-1" style="background:${lineBg};min-height:1rem"></div>` : ''}
                    </div>
                    <div class="${isLast ? '' : 'pb-4'}">
                        <p class="${labelCls}">${step.label}</p>
                        ${sublabel ? `<p class="text-[11px] text-gray-400">${sublabel}</p>` : ''}
                    </div>
                </div>`;
        }).join('');
    }

    openSolicitudForm(preloadOrden) {
        const esc        = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const productos  = app.dataInit.productos  || [];
        const sucursales = app.dataInit.sucursales || [];
        const branchId   = String(app.dataInit.branch_id || '');
        const hoy        = new Date().toLocaleDateString('en-CA');

        let rows = [];
        if (preloadOrden && preloadOrden.productos) {
            rows = preloadOrden.productos.map(p => ({
                id:     p.product_id,
                nombre: p.nombre,
                sku:    p.sku || '',
                cant:   p.quantity_ordered
            }));
        }

        const modalId = 'modalSolicitudForm';
        $(`#${modalId}`).remove();

        if (!document.getElementById('solicitudFormStyles')) {
            const style = document.createElement('style');
            style.id = 'solicitudFormStyles';
            style.textContent = `
                input.no-spin::-webkit-inner-spin-button,
                input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
                input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }`;
            document.head.appendChild(style);
        }

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] bg-black/45 flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-y-auto">
                <div class="w-full md:max-w-[960px] md:mx-3 bg-white flex flex-col overflow-hidden min-h-screen md:min-h-0 md:h-[90vh] md:rounded-2xl md:shadow-[0_24px_64px_rgba(0,0,0,0.25)]">

                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <i data-lucide="clipboard-list" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">${preloadOrden ? 'Duplicar solicitud' : 'Nueva solicitud'}</h3>
                                <p class="text-[11px] text-gray-500">Arma la lista de materiales que necesitas</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="grid grid-cols-4 gap-3 items-end">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Solicitar a</label>
                                <div class="relative">
                                    <select id="${modalId}_selSucursal" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">
                                        ${sucursales.filter(s => String(s.id) !== branchId).map(s => `<option value="${esc(s.id)}">${esc(s.valor)}</option>`).join('')}
                                    </select>
                                    <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 flex items-center">
                                        <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Fecha</label>
                                <input id="${modalId}_inpFecha" type="date" value="${hoy}" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400">
                            </div>
                        </div>
                    </div>

                    <div class="px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center"><i data-lucide="search" class="w-4 h-4"></i></span>
                            <input type="text" id="${modalId}_search" autocomplete="off" placeholder="Buscar materiales por nombre o SKU..." class="w-full pl-9 pr-3 py-2.5 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400">
                            <div id="${modalId}_results" class="hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden max-h-72 overflow-y-auto divide-y divide-gray-100"></div>
                        </div>
                    </div>

                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales solicitados</p>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Cantidad</th>
                                    <th class="w-12 px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody id="${modalId}_tbody" class="divide-y divide-gray-100"></tbody>
                        </table>
                    </div>

                    <div class="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 space-y-3">
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota / justificacion <span class="text-gray-400 normal-case">(opcional)</span></label>
                            <textarea id="${modalId}_note" rows="2" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all resize-none placeholder:text-gray-400" placeholder="Ej. Reabastecimiento semanal para la barra de bebidas..."></textarea>
                        </div>

                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-5 text-[11px] text-gray-500">
                                <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Materiales <strong class="text-gray-800 text-sm" id="${modalId}_totMat">0</strong></span>
                                <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Unidades <strong class="text-gray-800 text-sm" id="${modalId}_totUds">0</strong></span>
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                <button id="${modalId}_cancel" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all">Cancelar</button>
                                <button id="${modalId}_send" class="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5">
                                    <i data-lucide="send" class="w-3.5 h-3.5"></i><span>Enviar solicitud</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const renderTbody = () => {
            const $tbody = $(`#${modalId}_tbody`);
            if (!rows.length) {
                $tbody.html(`
                    <tr>
                        <td colspan="3" class="px-4 py-10">
                            <div class="flex flex-col items-center justify-center text-center gap-2 text-gray-400">
                                <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i data-lucide="package-plus" class="w-6 h-6 text-gray-400"></i>
                                </div>
                                <p class="text-sm font-semibold text-gray-500">Agrega productos para continuar</p>
                                <p class="text-xs text-gray-400">Usa el buscador de arriba para añadir materiales a la solicitud.</p>
                            </div>
                        </td>
                    </tr>`);
                $(`#${modalId}_totMat`).text('0');
                $(`#${modalId}_totUds`).text('0');
                if (window.lucide) lucide.createIcons();
                return;
            }

            $tbody.html(rows.map((row, idx) => `
                <tr data-idx="${idx}">
                    <td class="px-3 py-2.5">
                        <p class="font-medium text-gray-700">${esc(row.nombre)}</p>
                        ${row.sku ? `<p class="text-[10px] text-gray-400">${esc(row.sku)}</p>` : ''}
                    </td>
                    <td class="px-3 py-2.5">
                        <input type="number" min="1" value="${row.cant}" class="no-spin w-full px-3 py-1.5 text-xs font-bold text-center text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" data-field="cant" data-idx="${idx}">
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <button class="btn-remove w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-rose-500 transition-colors mx-auto" data-idx="${idx}">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join(''));

            if (window.lucide) lucide.createIcons();
            updateTotals();
        };

        const updateTotals = () => {
            let totalUds = 0;
            rows.forEach(r => { totalUds += Number(r.cant || 0); });
            $(`#${modalId}_totMat`).text(rows.length);
            $(`#${modalId}_totUds`).text(totalUds % 1 === 0 ? String(totalUds) : totalUds.toFixed(2));
        };

        const focusCantidad = (idx) => {
            const $inp = $(`#${modalId}_tbody tr[data-idx="${idx}"] input[data-field="cant"]`);
            if ($inp.length) {
                if ($inp[0].scrollIntoView) $inp[0].scrollIntoView({ block: 'nearest' });
                $inp.trigger('focus').trigger('select');
            } else {
                $(`#${modalId}_search`).trigger('focus');
            }
        };

        renderTbody();

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
                     data-id="${p.id}" data-nombre="${esc(p.nombre)}" data-sku="${esc(p.sku || '')}">
                    <div class="flex items-center gap-2">
                        <span class="w-7 h-7 rounded bg-gray-100 flex items-center justify-center">
                            <i data-lucide="package" class="w-3.5 h-3.5 text-gray-500"></i>
                        </span>
                        <div>
                            <p class="text-xs font-medium text-gray-700">${esc(p.nombre)}</p>
                            <p class="text-[10px] text-gray-400">${esc(p.sku || 'Sin SKU')}${p.categoria ? ' &middot; ' + esc(p.categoria) : ''}</p>
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
            const id     = String($(this).data('id'));
            const nombre = $(this).data('nombre');
            const sku    = $(this).data('sku');
            const exists = rows.findIndex(r => String(r.id) === id);
            let idx;
            if (exists >= 0) {
                rows[exists].cant += 1;
                idx = exists;
            } else {
                rows.push({ id, nombre, sku, cant: 1 });
                idx = rows.length - 1;
            }
            $search.val('');
            $results.addClass('hidden').html('');
            renderTbody();
            focusCantidad(idx);
        });

        $(`#${modalId}_tbody`).on('input', 'input[data-field="cant"]', function () {
            const idx = parseInt($(this).attr('data-idx'), 10);
            if (isNaN(idx) || !rows[idx]) return;
            rows[idx].cant = Number($(this).val() || 0);
            updateTotals();
        });

        $(`#${modalId}_tbody`).on('keydown', 'input[data-field="cant"]', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                $search.trigger('focus');
            }
        });

        $(`#${modalId}_tbody`).on('click', '.btn-remove', function () {
            const idx = parseInt($(this).attr('data-idx'), 10);
            rows.splice(idx, 1);
            renderTbody();
        });

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_cancel`).on('click', closeModal);
        $modal.on('click', (e) => { if ($(e.target).is(`#${modalId}`)) closeModal(); });

        $(`#${modalId}_send`).on('click', () => this.sendSolicitud(modalId, rows, closeModal));

        // Al abrir, el foco arranca en el buscador para teclear/escanear de una.
        setTimeout(() => $(`#${modalId}_search`).trigger('focus'), 50);
    }

    sendSolicitud(modalId, rows, closeModal) {
        if (!rows.length) {
            this.alertBox({
                type:       'warning',
                title:      'Agrega productos para continuar',
                detailHtml: 'Necesitas agregar al menos un material antes de enviar la solicitud.'
            });
            return;
        }

        if (!($(`#${modalId}_selSucursal`).val() || '')) {
            this.alertBox({
                type:       'warning',
                title:      'Selecciona una sucursal',
                detailHtml: 'Debes elegir a qué sucursal le solicitas los materiales.'
            });
            return;
        }

        const total = rows.length;
        this.alertBox({
            type:        'confirm',
            title:       '¿Deseas crear la solicitud?',
            detailHtml:  `Se enviará la solicitud con <strong>${total}</strong> material${total !== 1 ? 'es' : ''}.`,
            okLabel:     'Sí, crear solicitud',
            okIcon:      'send',
            cancelLabel: 'Revisar',
            onOk:        () => this.submitSolicitud(modalId, rows, closeModal)
        });
    }

    async submitSolicitud(modalId, rows, closeModal) {
        const payload = {
            branch_id:  $(`#${modalId}_selSucursal`).val() || '',
            date_order: $(`#${modalId}_inpFecha`).val() || '',
            note:       $(`#${modalId}_note`).val() || '',
            submit:     true,
            productos:  rows.map(r => ({
                product_id:        r.id,
                quantity:          r.cant,
                cost:              null,
                price_without_tax: null,
                tax:               0,
                unit_id:           null
            }))
        };

        const r = await useFetch({
            url:  apiOrdenes,
            data: { opc: 'saveOrden', payload: JSON.stringify(payload) }
        });

        if (r && r.status === 200) {
            this.alertBox({
                type:  'success',
                title: r.message || 'Solicitud enviada correctamente',
                timer: 1800
            });
            closeModal();
            solicitudes.lsSolicitudes();
            solicitudes.lsKpis();
        } else {
            this.alertBox({
                type:  'error',
                title: (r && r.message) || 'No se pudo enviar la solicitud'
            });
        }
    }
}
