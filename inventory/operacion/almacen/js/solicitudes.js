let apiOrdenes = 'ctrl/ctrl-ordenes.php';
let app, solicitudes, solicitudesView;

$(async () => {
    solicitudesView = new SolicitudesView(apiOrdenes, 'root');
    solicitudes     = new Solicitudes(apiOrdenes, 'root');
    app             = new App(apiOrdenes, 'root');
    await app.init();
});

// ============================================================
// App — bootstrap, layout, filterBar
// ============================================================

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'solicitudes';
        this.selectedId   = null;
        this.selectedFolio = null;
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
            // El init no trae el nombre de la sucursal; lo derivamos del catalogo
            // de sucursales usando el branch_id de sesion.
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
        solicitudes.lsSolicitudes();
    }

    layout() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const branchName = esc(this.dataInit.branch_name || 'Mi sucursal');
        const initials   = this._initials(this.dataInit.user_name || '');

        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full'
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'hidden md:flex w-full md:w-[420px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex-col overflow-hidden'
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

        $('#mainPanel').html(`
            <!-- ===== viewHeader ===== -->
            <div id="viewHeader" class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
                <div>
                    <h1 class="text-lg font-bold text-gray-800">Mis solicitudes</h1>
                    <p class="text-xs text-gray-500">Pide materiales y da seguimiento a tus solicitudes</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBF3EF] text-[#A84A33] text-xs font-semibold border border-[#EFC9BC]">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> ${branchName}
                    </span>
                    <button id="btnNuevaSolicitud"
                        class="hidden md:flex px-3.5 py-2 text-xs font-bold text-white rounded-md hover:opacity-90 items-center gap-1.5"
                        style="background:#C05A40">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nueva solicitud
                    </button>
                    <!-- Avatar (movil) -->
                    <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 md:hidden" style="background:#C05A40">${initials}</div>
                </div>
            </div>

            <!-- ===== filterBar (escritorio: estado + buscador) ===== -->
            <div id="filterBar" class="hidden md:block px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0">
                <div class="flex flex-wrap items-center gap-3">
                    <div id="statusChipsDesktop" class="flex items-center gap-1.5 flex-wrap"></div>
                    <div class="relative ml-auto min-w-[220px]">
                        <i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                        <input id="qBuscar" type="text" placeholder="Buscar por folio..."
                            class="w-full pl-9 pr-3 py-2 text-xs text-gray-800 bg-white border border-gray-300 rounded-lg outline-none focus:border-[#C05A40]">
                    </div>
                </div>
            </div>

            <!-- ===== kpisRow ===== -->
            <div id="kpisRow" class="hidden md:block px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0"></div>

            <!-- ===== tableWrap (escritorio) ===== -->
            <div id="tableWrap" class="hidden md:block p-3 flex-1 min-h-0 overflow-auto bg-white"></div>

            <!-- ===== MOBILE: top bar chips ===== -->
            <div id="mobileTopBar" class="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 pt-3 pb-3 flex-shrink-0">
                <div id="statusChipsMobile" class="flex items-center gap-2 overflow-x-auto -mx-4 px-4" style="scrollbar-width:none"></div>
            </div>

            <!-- ===== MOBILE: lista de cards ===== -->
            <div id="mobileCards" class="md:hidden flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-3 bg-gray-50"></div>

            <!-- ===== MOBILE: FAB ===== -->
            <button id="fabNueva"
                class="md:hidden fixed bottom-20 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-40"
                style="background:#C05A40;box-shadow:0 4px 14px rgba(192,90,64,.45)">
                <i data-lucide="plus" class="w-6 h-6"></i>
            </button>

            <!-- ===== MOBILE: bottom nav ===== -->
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

        $('#detailPanel').html(`
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                <i data-lucide="clipboard-list" class="w-10 h-10 text-gray-300 mb-3"></i>
                <p class="text-sm font-semibold text-gray-500">Selecciona una solicitud</p>
                <p class="text-xs text-gray-400 mt-1 max-w-[200px]">Haz click en una fila para ver el seguimiento aqui.</p>
            </div>
        `);

        this._buildStatusChips();

        $('#btnNuevaSolicitud, #fabNueva').on('click', () => solicitudesView.openSolicitudForm());

        $('#qBuscar').on('input', () => {
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => solicitudes.lsSolicitudes(), 300);
        });

        if (window.lucide) lucide.createIcons();
    }

    _initials(name) {
        const parts = (name || '').trim().split(/\s+/);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    _buildStatusChips() {
        const statuses = [
            { id: '', label: 'Todas' },
            { id: 'Solicitada',   label: 'Solicitada' },
            { id: 'Aprobada',     label: 'Aprobada' },
            { id: 'Parcial',      label: 'En recepcion' },
            { id: 'Recibida',     label: 'Recibida' },
            { id: 'Rechazada',    label: 'Rechazada' },
            { id: 'Borrador',     label: 'Borrador' }
        ];

        const buildChips = (containerId) => {
            const $c = $(`#${containerId}`);
            $c.html(statuses.map((s, i) => {
                const active = i === 0;
                const base   = active
                    ? 'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white whitespace-nowrap'
                    : 'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-gray-600 border border-gray-300 whitespace-nowrap hover:border-[#C05A40]';
                const style  = active ? 'style="background:#C05A40"' : '';
                return `<button class="chip-status ${base}" data-status="${s.id}" ${style}>${s.label}</button>`;
            }).join(''));

            $c.on('click', '.chip-status', function () {
                $c.find('.chip-status').each(function () {
                    $(this).removeClass('text-white').addClass('bg-white text-gray-600 border border-gray-300');
                    $(this).removeAttr('style');
                });
                $(this).removeClass('bg-white text-gray-600 border border-gray-300').addClass('text-white');
                $(this).attr('style', 'background:#C05A40');
                app.activeStatus = $(this).data('status');
                solicitudes.lsSolicitudes();
            });
        };

        buildChips('statusChipsDesktop');
        buildChips('statusChipsMobile');

        this.activeStatus = '';
    }

    getFilters() {
        return {
            status: this.activeStatus || '',
            q:      $('#qBuscar').val() || '',
            mine:   1
        };
    }

    selectSolicitud(folio, id) {
        this.selectedFolio = folio;
        this.selectedId    = id;

        $(`#tbsolicitudes tbody tr`).removeClass('row-active');
        if (folio) {
            $(`#tbsolicitudes tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            }).addClass('row-active');
            solicitudes.getOrden(id);
        } else {
            solicitudesView.renderDetailEmpty();
        }
    }
}

// ============================================================
// Solicitudes — datos, tabla, cards, KPIs
// ============================================================

class Solicitudes extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'solicitudes';
    }

    async lsSolicitudes() {
        const f = app.getFilters();
        const r = await useFetch({
            url:  apiOrdenes,
            data: { opc: 'lsOrdenes', mine: 1, status: f.status, q: f.q }
        });

        const rows = (r && r.status === 200 && r.row) ? r.row : [];

        this._renderTable(rows);
        this._renderCards(rows);
        this._renderKpis(rows);
    }

    _renderTable(rows) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

        const thead = `
            <table id="tbsolicitudes" class="w-full text-[13px] border-collapse">
                <thead class="sticky top-0 z-10">
                    <tr class="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider">
                        <th class="text-left font-semibold px-3 py-2 border-b border-gray-200">Folio</th>
                        <th class="text-left font-semibold px-3 py-2 border-b border-gray-200">Fecha</th>
                        <th class="text-center font-semibold px-3 py-2 border-b border-gray-200">Estado</th>
                        <th class="text-center font-semibold px-3 py-2 border-b border-gray-200">Materiales</th>
                        <th class="text-left font-semibold px-3 py-2 border-b border-gray-200">Almacen / Sucursal</th>
                        <th class="text-center font-semibold px-3 py-2 border-b border-gray-200">Ver</th>
                    </tr>
                </thead>
                <tbody class="text-gray-700">`;

        if (!rows.length) {
            $('#tableWrap').html(`${thead}
                    <tr><td colspan="6" class="px-3 py-10 text-center text-xs text-gray-400 italic">
                        <i data-lucide="clipboard-list" class="w-8 h-8 mx-auto mb-2 text-gray-300 block"></i>
                        No se encontraron solicitudes
                    </td></tr>
                </tbody></table>`);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const tbodyRows = rows.map(row => {
            const actions = (row.a || []);
            const idVal   = actions.find(a => a.opc === 'getOrden') ? actions.find(a => a.opc === 'getOrden').id : (row.id || '');
            const folio   = esc(row.Folio || row.folio || '');
            const fecha   = esc(row.Fecha || row.fecha || '');
            const badge   = row.Estado || '';
            const mats    = esc(row.Materiales || row.materiales || '—');
            const lugar   = esc(row.Almacen || row.almacen || row.Sucursal || '—');

            return `<tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        data-folio="${folio}" data-id="${esc(String(idVal))}"
                        onclick="app.selectSolicitud('${folio}', '${esc(String(idVal))}')">
                <td class="px-3 py-2 font-semibold text-gray-800">${folio}</td>
                <td class="px-3 py-2">${fecha}</td>
                <td class="px-3 py-2 text-center">${badge}</td>
                <td class="px-3 py-2 text-center">${mats}</td>
                <td class="px-3 py-2">${lugar}</td>
                <td class="px-3 py-2 text-center"><i data-lucide="eye" class="w-4 h-4 text-gray-400 inline"></i></td>
            </tr>`;
        }).join('');

        $('#tableWrap').html(`${thead}${tbodyRows}</tbody></table>`);

        if (window.lucide) lucide.createIcons();
        if (typeof simple_data_table === 'function' && rows.length > 10) {
            simple_data_table('#tbsolicitudes', 10);
        }
    }

    _renderCards(rows) {
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
            const actions  = (row.a || []);
            const idVal    = actions.find(a => a.opc === 'getOrden') ? actions.find(a => a.opc === 'getOrden').id : (row.id || '');
            const folio    = esc(row.Folio || row.folio || '');
            const fecha    = esc(row.Fecha || '');
            const badge    = row.Estado || '';
            const mats     = parseInt(row.Materiales || row.materiales || 0, 10);
            const preview  = esc(row.preview || '');

            const fechaRel = this._fechaRelativa(fecha);

            return `<div class="block bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm cursor-pointer active:scale-[.99] transition-transform"
                        data-folio="${folio}" data-id="${esc(String(idVal))}"
                        onclick="solicitudesView.openMobileDetail('${folio}', '${esc(String(idVal))}')">
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

    _renderKpis(rows) {
        const counts = { Solicitada: 0, Aprobada: 0, Parcial: 0, Recibida: 0 };
        rows.forEach(row => {
            const st = row.status || row.Status || '';
            if (counts[st] !== undefined) counts[st]++;
        });

        const kpis = [
            { id: 'kpiSolicitadas', label: 'Solicitadas',  value: counts.Solicitada, tone: 'warning'  },
            { id: 'kpiAprobadas',   label: 'Aprobadas',    value: counts.Aprobada,   tone: 'default'  },
            { id: 'kpiEnRecepcion', label: 'En recepcion', value: counts.Parcial,    tone: 'warning'  },
            { id: 'kpiRecibidas',   label: 'Recibidas',    value: counts.Recibida,   tone: 'success'  }
        ];
        solicitudesView.renderKpis(kpis);
    }

    _fechaRelativa(fechaStr) {
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
            solicitudesView.renderDetailEmpty();
        }
    }

    mapOrdenDetail(h, detail) {
        return {
            id:               h.id,
            folio:            h.folio,
            status:           h.status,
            status_badge:     h.status_badge || '',
            supplier_id:      h.supplier_id,
            supplier_name:    h.supplier_name  || '',
            branch_id:        h.branch_id,
            branch_name:      h.branch_name    || '',
            warehouse_id:     h.warehouse_id,
            warehouse_name:   h.warehouse_name || '',
            date_order:       h.date_order     || '',
            expected_date:    h.expected_date  || '',
            note:             h.note           || '',
            user_name:        h.user_name      || '',
            approved_user_name: h.approved_user_name || '',
            approved_at:      h.approved_at    || '',
            reject_reason:    h.reject_reason  || '',
            total_products:   parseInt(h.total_products || 0, 10),
            total_units:      Number(h.total_units  || 0),
            productos: (detail || []).map(d => ({
                detailId:          d.id,
                product_id:        d.product_id,
                nombre:            d.product_name,
                sku:               d.sku         || '',
                unit_id:           d.unit_id,
                quantity_ordered:  Number(d.quantity_ordered  || 0),
                quantity_received: Number(d.quantity_received || 0)
            }))
        };
    }
}

// ============================================================
// SolicitudesView — paneles, overlays, formulario, detalle
// ============================================================

class SolicitudesView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'solicitudes';
    }

    // ----------------------------------------------------------
    // KPIs
    // ----------------------------------------------------------

    renderKpis(rows) {
        const tones = { default: 'text-gray-800', success: 'text-green-600', warning: 'text-amber-500', danger: 'text-red-600' };
        const toneClass = (t) => tones[t] || tones.default;
        const $grid = $('<div>', { class: 'grid grid-cols-2 md:grid-cols-4 gap-4' });
        $grid.html(rows.map(kpi => `
            <div id="${kpi.id}" class="bg-white rounded-lg border border-gray-200 px-4 py-3 hover:shadow-lg transition-shadow">
                <p class="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1 text-right">${kpi.label}</p>
                <p class="text-2xl font-bold text-right ${toneClass(kpi.tone)}">${kpi.value}</p>
            </div>
        `).join(''));
        $('#kpisRow').html($grid);
    }

    // ----------------------------------------------------------
    // Panel detalle escritorio — aside derecho (solo lectura)
    // ----------------------------------------------------------

    renderDetailEmpty() {
        $('#detailPanel').html(`
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                <i data-lucide="clipboard-list" class="w-10 h-10 text-gray-300 mb-3"></i>
                <p class="text-sm font-semibold text-gray-500">Selecciona una solicitud</p>
                <p class="text-xs text-gray-400 mt-1 max-w-[200px]">Haz click en una fila para ver el seguimiento aqui.</p>
            </div>
        `);
        if (window.lucide) lucide.createIcons();
    }

    renderDetail(orden) {
        if (!orden) { this.renderDetailEmpty(); return; }
        $('#detailPanel').html(this._buildDetailHtml(orden, false));
        this._bindDetailEvents(orden, false);
        if (window.lucide) lucide.createIcons();
    }

    // ----------------------------------------------------------
    // Overlay de detalle en movil (full-screen)
    // ----------------------------------------------------------

    openMobileDetail(folio, id) {
        app.selectedFolio = folio;
        app.selectedId    = id;

        const $ov = $(`#mobileDetailOverlay`);
        if ($ov.length) $ov.remove();

        const $overlay = $(`
            <div id="mobileDetailOverlay" class="md:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
                <div id="mobileDetailContent" class="flex-1 overflow-y-auto pb-20"></div>
                <div id="mobileDetailFooter" class="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-2"></div>
            </div>
        `);
        $('body').append($overlay);
        if (window.lucide) lucide.createIcons();

        solicitudes.getOrden(id).then(() => {});
    }

    _renderMobileDetail(orden) {
        const $content = $('#mobileDetailContent');
        const $footer  = $('#mobileDetailFooter');
        if (!$content.length) return;

        $content.html(this._buildDetailHtml(orden, true));
        $footer.html(`
            <button id="mobileDetailBack" class="flex-1 px-3.5 py-2.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg flex items-center justify-center gap-1.5">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Volver
            </button>
            <button id="mobileDetailDuplicate" class="flex-1 px-3.5 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border" style="border-color:#C05A40;color:#C05A40">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Duplicar
            </button>
        `);

        if (window.lucide) lucide.createIcons();

        $('#mobileDetailBack').on('click', () => { $('#mobileDetailOverlay').remove(); });
        $('#mobileDetailDuplicate').on('click', () => {
            $('#mobileDetailOverlay').remove();
            this.openSolicitudForm(orden);
        });
    }

    // ----------------------------------------------------------
    // HTML compartido del detalle (escritorio aside + mobile overlay)
    // ----------------------------------------------------------

    _buildDetailHtml(orden, isMobile) {
        const esc    = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const e      = orden;
        const status = e.status || '';

        const stepperHtml = this._buildStepper(status);
        const rejectHtml  = (status === 'Rechazada' && e.reject_reason)
            ? `<div class="mx-4 my-3 rounded-lg px-3 py-2.5" style="border-left:3px solid #E02424;background:rgba(224,36,36,.07)">
                   <p class="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style="color:#E02424">Motivo del rechazo</p>
                   <p class="text-xs text-gray-700">${esc(e.reject_reason)}</p>
               </div>`
            : '';

        const productosHtml = (e.productos || []).map(p => {
            const recibido = p.quantity_received;
            const ordenado = p.quantity_ordered;
            const completo = recibido >= ordenado && ordenado > 0;
            const parcial  = recibido > 0 && recibido < ordenado;
            const pendiente = recibido === 0;

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

            const showRecv = ['Parcial', 'Recibida', 'Aprobada'].includes(status);

            if (isMobile) {
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
            }

            return `
                <div class="flex items-center justify-between py-2 border-b border-gray-100 gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-gray-700 truncate">${esc(p.nombre)}</p>
                        ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                    </div>
                    <div class="text-right flex-shrink-0 space-y-0.5">
                        <p class="text-xs font-semibold text-gray-800">${fmtNum(ordenado)}</p>
                        ${showRecv ? `<p class="text-[10px] font-semibold" style="color:${recvColor}">${recvLabel}</p>` : ''}
                    </div>
                </div>`;
        }).join('');

        const totUds = (e.productos || []).reduce((s, p) => s + p.quantity_ordered, 0);
        const totRcv = (e.productos || []).reduce((s, p) => s + p.quantity_received, 0);

        if (isMobile) {
            return `
                <!-- Top bar con back + folio + badge -->
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

                    <!-- Timeline vertical mobile -->
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3.5">Seguimiento</p>
                        ${this._buildMobileStepper(status)}
                    </div>

                    <!-- Datos -->
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

                    <!-- Materiales -->
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Materiales pedidos</label>
                            <span class="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">${(e.productos || []).length}</span>
                        </div>
                        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                            ${productosHtml || '<div class="px-3.5 py-4 text-xs text-gray-400 italic text-center">Sin materiales</div>'}
                        </div>
                    </div>

                    <!-- Resumen -->
                    <div class="text-xs text-gray-500 flex items-center justify-between px-1">
                        <span>${(e.productos || []).length} material${(e.productos || []).length !== 1 ? 'es' : ''} &middot; ${fmtNum(totUds)} unidades pedidas</span>
                        ${totRcv > 0 ? `<span class="font-semibold" style="color:#C05A40">${fmtNum(totRcv)} recibidas</span>` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- Header folio + badge + cerrar -->
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">Seguimiento de solicitud</p>
                        <p class="text-base font-bold text-gray-800">${esc(e.folio || '-')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${e.status_badge || `<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">${esc(status)}</span>`}
                        <button id="detailClose" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <!-- Stepper horizontal -->
                ${stepperHtml}

                ${rejectHtml}

                <!-- Datos cabecera -->
                <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 space-y-1.5">
                    ${e.user_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Solicitado por</span><span class="text-gray-700 text-right">${esc(e.user_name)}</span></div>` : ''}
                    ${e.date_order ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Fecha</span><span class="text-gray-700 text-right">${esc(e.date_order)}</span></div>` : ''}
                    ${e.branch_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Sucursal</span><span class="text-gray-700 text-right">${esc(e.branch_name)}</span></div>` : ''}
                    ${e.warehouse_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Almacen destino</span><span class="text-gray-700 text-right">${esc(e.warehouse_name)}</span></div>` : ''}
                    ${e.supplier_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Proveedor</span><span class="text-gray-700 text-right">${esc(e.supplier_name)}</span></div>` : ''}
                    ${e.approved_user_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Aprobado por</span><span class="text-gray-700 text-right">${esc(e.approved_user_name)}</span></div>` : ''}
                    ${e.note ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Nota</span><span class="text-gray-700 text-right">${esc(e.note)}</span></div>` : ''}
                </div>

                <!-- Lista materiales -->
                <div class="flex-1 overflow-y-auto px-4 py-3">
                    <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Materiales (${(e.productos || []).length})</p>
                    ${productosHtml || '<p class="text-xs text-gray-400 italic">Sin materiales</p>'}
                </div>

                <!-- Footer: conteos + duplicar -->
                <div class="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>${(e.productos || []).length} materiales &middot; ${fmtNum(totUds)} unidades pedidas</span>
                        ${totRcv > 0 ? `<span class="font-semibold" style="color:#C05A40">${fmtNum(totRcv)} recibidas</span>` : ''}
                    </div>
                    <button id="detailDuplicate" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity" style="border-color:#C05A40;color:#C05A40">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i> Duplicar solicitud
                    </button>
                </div>
            </div>
        `;
    }

    _bindDetailEvents(orden, isMobile) {
        if (isMobile) {
            $('#mobileDetailBackTop').on('click', () => { $('#mobileDetailOverlay').remove(); });
        } else {
            $('#detailClose').on('click', () => { app.selectSolicitud(null); });
            $('#detailDuplicate').on('click', () => { this.openSolicitudForm(orden); });
        }
    }

    // ----------------------------------------------------------
    // Stepper horizontal (panel escritorio)
    // ----------------------------------------------------------

    _buildStepper(status) {
        const steps = ['Borrador', 'Solicitada', 'Aprobada', 'Parcial', 'Recibida'];
        const specialStatuses = ['Rechazada', 'Cancelada'];
        const isSpecial = specialStatuses.includes(status);
        const activeIdx = isSpecial ? -1 : steps.indexOf(status);

        if (isSpecial) {
            return `<div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
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

        return `<div class="flex items-center gap-0 px-4 py-2.5 border-b border-gray-200 flex-shrink-0 overflow-x-auto">${stepsHtml}</div>`;
    }

    // ----------------------------------------------------------
    // Stepper vertical (overlay mobile)
    // ----------------------------------------------------------

    _buildMobileStepper(status) {
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

    // ----------------------------------------------------------
    // Formulario nueva solicitud (modal unico responsive)
    // ----------------------------------------------------------

    openSolicitudForm(preloadOrden) {
        const esc        = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const productos  = app.dataInit.productos  || [];
        const sucursales = app.dataInit.sucursales || [];
        const branchId   = String(app.dataInit.branch_id || '');
        const hoy        = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

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

        // CSS del input de cantidad sin flechas (mismo no-spin de EntradaForm);
        // se inyecta una sola vez porque solicitudes.php no carga entrada-form.js.
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

                    <!-- Header -->
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

                    <!-- Datos (zona fija): sucursal -->
                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="grid grid-cols-4 gap-3 items-end">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sucursal solicitante</label>
                                <div class="relative">
                                    <select id="${modalId}_selSucursal" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">
                                        ${sucursales.map(s => `<option value="${esc(s.id)}"${String(s.id) === branchId ? ' selected' : ''}>${esc(s.valor)}</option>`).join('')}
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

                    <!-- Buscador (zona fija) -->
                    <div class="px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center"><i data-lucide="search" class="w-4 h-4"></i></span>
                            <input type="text" id="${modalId}_search" autocomplete="off" placeholder="Buscar materiales por nombre o SKU..." class="w-full pl-9 pr-3 py-2.5 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400">
                            <div id="${modalId}_results" class="hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden max-h-72 overflow-y-auto divide-y divide-gray-100"></div>
                        </div>
                    </div>

                    <!-- Encabezado lista (zona fija) -->
                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales solicitados</p>
                    </div>

                    <!-- Lista de materiales (zona flexible con scroll) -->
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

                    <!-- Nota (zona fija) -->
                    <div class="px-5 py-3 border-t border-gray-200 bg-white flex-shrink-0">
                        <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota / justificacion <span class="text-gray-400 normal-case">(opcional)</span></label>
                        <textarea id="${modalId}_note" rows="2" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all resize-none placeholder:text-gray-400" placeholder="Ej. Reabastecimiento semanal para la barra de bebidas..."></textarea>
                    </div>

                    <!-- Resumen (zona fija) -->
                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-5 text-[11px] text-gray-500">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Materiales <strong class="text-gray-800 text-sm" id="${modalId}_totMat">0</strong></span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Unidades <strong class="text-gray-800 text-sm" id="${modalId}_totUds">0</strong></span>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_cancel" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all">Cancelar</button>
                        <button id="${modalId}_send" class="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5">
                            <i data-lucide="send" class="w-3.5 h-3.5"></i><span>Enviar solicitud</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const renderTbody = () => {
            const $tbody = $(`#${modalId}_tbody`);
            if (!rows.length) {
                $tbody.html(`<tr><td colspan="3" class="px-3 py-4 text-center text-xs text-gray-400 italic">Agrega materiales usando el buscador de arriba</td></tr>`);
                $(`#${modalId}_totMat`).text('0');
                $(`#${modalId}_totUds`).text('0');
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

        // Enfoca y preselecciona el input de cantidad de la fila recien
        // agregada (mismo flujo que EntradaForm.focusCantidad): al teclear se
        // reemplaza el valor y Enter regresa al buscador para encadenar.
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

        // Buscador
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

        // Cantidad editable: actualiza el total al teclear; Enter regresa al
        // buscador para encadenar la siguiente alta (igual que EntradaForm).
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

        $(`#${modalId}_send`).on('click', () => this._sendSolicitud(modalId, rows, closeModal));
    }

    async _sendSolicitud(modalId, rows, closeModal) {
        if (!rows.length) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Agrega al menos un material' });
            return;
        }

        const payload = {
            branch_id:  $(`#${modalId}_selSucursal`).val() || app.dataInit.branch_id || '',
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
            if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Solicitud enviada correctamente' });
            closeModal();
            solicitudes.lsSolicitudes();
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo enviar la solicitud' });
        }
    }
}

// ----------------------------------------------------------
// Hook: renderDetail se redirige desde Solicitudes.getOrden
// para distinguir escritorio vs movil en el mismo flujo
// ----------------------------------------------------------

const _origRenderDetail = SolicitudesView.prototype.renderDetail;
SolicitudesView.prototype.renderDetail = function (orden) {
    const isMobileOverlayOpen = $('#mobileDetailOverlay').length > 0;

    if (isMobileOverlayOpen) {
        if (!orden) {
            $('#mobileDetailOverlay').remove();
        } else {
            this._renderMobileDetail(orden);
        }
    } else {
        _origRenderDetail.call(this, orden);
    }
};
