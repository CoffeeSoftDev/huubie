// -- Requisiciones y Surtir --
// Las «Requisiciones» (quien pide) y el «Surtir» (quien surte) de
// inventory/operacion/almacen aplicados al Catálogo de pro. Un solo archivo para
// las dos páginas: el lado sale del nombre de la página (surtir.php = entregas).
// Visor con filtros, leyenda de estados, tabla y el detalle a la derecha; la
// pestaña Calendario los pone en el día en que se necesitan. La captura es la
// hoja de inventory (components/orden-form.js). Comunes en inventarios.js.

const REQ_LADO = /surtir\.php/i.test(location.pathname) ? 'entregas' : 'pedidos';

let apiReq = REQ_LADO === 'entregas' ? 'ctrl/ctrl-surtir.php' : 'ctrl/ctrl-requisiciones.php';
let app, requisiciones, requisicionesView, calendario;

const VIEW_HEADER_REQ = REQ_LADO === 'entregas'
    ? { title: 'Surtir requisiciones', subtitle: 'Lo que las sucursales le piden a la tuya: surte, rechaza o revierte' }
    : { title: 'Requisiciones', subtitle: 'Lo que tu sucursal pide a la Matriz u otra sucursal, y su recepción' };

$(async () => {
    requisicionesView = new RequisicionesView(apiReq, 'root');
    requisiciones     = new Requisiciones(apiReq, 'root');
    calendario        = new CalendarioReq(apiReq, 'root');
    app               = new App(apiReq, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'requisiciones';
        this.selectedId   = null;
        this.rangeFi      = '';
        this.rangeFf      = '';
        this.vista        = 'lista';
    }

    async init() {
        const r = await useFetch({ url: apiReq, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch_id:     r.branch_id || '',
            branch:        (r.scope || {}).branch || '',
            askBranchId:   r.ask_branch_id || '',
            sucursales:    r.sucursales    || [],
            departamentos: r.departamentos || [],
            unidades:      r.unidades      || [],
            productos:     r.productos     || [],
            estados:       r.estados       || [],
            almacenes:     r.almacenes     || [],
            costs:         !!r.costs
        };

        this.render();

        // ?id=12 (el aviso o un enlace): abre esa requisición.
        const id = Number(new URLSearchParams(location.search).get('id'));
        if (id) this.selectRequisicion(id);
    }

    render() {
        this.invVisorLayout({ id: this.PROJECT_NAME, key: 'requisiciones' });
        this.visorResize({ key: 'requisiciones', label: 'Ancho del detalle de la requisición' });

        // La pestaña Calendario vive junto a la tabla, en el mismo panel.
        $('#tableWrap').after('<div id="calendarWrap" class="hidden p-3 flex-1 min-h-0 overflow-auto bg-white"></div>');

        requisicionesView.renderHeader();
        this.filterBar();
        requisicionesView.renderLegend();
        requisicionesView.renderDetail(null);
        requisiciones.lsRequisiciones();
    }

    filterBar() {
        const filters = [
            { opc: 'input-calendar', id: 'fRango', lbl: 'Creadas:', class: 'col-12 col-md-6 col-lg-3', readonly: true, placeholder: 'Selecciona un rango', required: false },
            { opc: 'select', id: 'fEstado', lbl: 'Estado:', class: 'col-12 col-md-6 col-lg-3', onchange: 'app.onChangeFilters()', data: this.dataInit.estados }
        ];

        if (REQ_LADO === 'pedidos' && can('agregar')) {
            filters.push({ opc: 'button', id: 'btnNuevaRequisicion', text: 'Nueva requisición', color_btn: 'primary', class: 'col-12 col-md-6 col-lg-3', onClick: () => requisiciones.openNueva() });
        }

        this.createfilterBar({ parent: 'filterBar', coffeesoft: true, theme: 'light', data: filters });

        const range = this.invRangePicker({
            parent:   'fRango',
            days:     29,
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
        return { fi: this.rangeFi || '', ff: this.rangeFf || '', estado: $('#fEstado').val() || '' };
    }

    onChangeFilters() {
        requisiciones.lsRequisiciones();
    }

    // Lista | Calendario (los botones del encabezado).
    setVista(vista) {
        this.vista = vista === 'calendario' ? 'calendario' : 'lista';

        const cal = this.vista === 'calendario';

        $('#tableWrap, #filterBar, #kpisRow').toggleClass('hidden', cal);
        $('#calendarWrap').toggleClass('hidden', !cal);
        $('[data-req-vista]').each(function () {
            const on = $(this).attr('data-req-vista') === (cal ? 'calendario' : 'lista');
            $(this).toggleClass('bg-white text-gray-800 shadow-sm', on).toggleClass('text-gray-500', !on);
        });

        if (cal) calendario.render();
    }

    selectRequisicion(id) {
        this.selectedId = id || null;
        this.markRow(this.selectedId);

        if (id) requisiciones.getRequisicion(id);
        else requisicionesView.renderDetail(null);
    }

    markRow(id) {
        const $rows = $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!id) return;

        $rows.filter(function () {
            return $(this).find(`[onclick*="selectRequisicion(${id})"]`).length > 0;
        }).addClass('row-active');
    }
}

class Requisiciones extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'requisiciones';
        this.current      = null;
    }

    // Columnas: Folio, Fecha, Lo necesita, Área, Surte | Pide, Productos, Estado
    async lsRequisiciones() {
        const r    = await useFetch({ url: apiReq, data: Object.assign({ opc: 'lsRequisiciones' }, app.getFilters()) });
        const data = (r && r.status === 200) ? { row: r.row || [] } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [1, 2, 3, 4, 6, 7],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: REQ_LADO === 'entregas' ? 'No te han pedido nada en este periodo' : 'No hay requisiciones con los filtros aplicados',
            emptyIcon:    'icon-doc-text',
            data
        });

        if (window.lucide) lucide.createIcons();

        if (data.row.length && typeof simple_data_table === 'function') simple_data_table(`#tb${this.PROJECT_NAME}`, 15);

        app.markRow(app.selectedId);
    }

    async getRequisicion(id) {
        const r = await useFetch({ url: apiReq, data: { opc: 'getRequisicion', id } });

        if (!(r && r.status === 200)) {
            requisicionesView.renderDetail(null);
            if (r && r.message) this.alertBox({ type: 'error', title: r.message });
            return null;
        }

        this.current = r;
        requisicionesView.renderDetail(r);

        return r;
    }

    refresh(id) {
        this.lsRequisiciones();
        if (app.vista === 'calendario') calendario.reload();
        if (id) app.selectRequisicion(id);
    }

    // -- Capturar (Requisiciones) --

    ordenFormInstance() {
        if (this.ordenFormApi) return this.ordenFormApi;

        this.ordenFormApi = this.ordenForm({
            parent: 'body',
            id:     'ordenFormModal',
            json:   app.dataInit.productos || [],
            montos: false,
            labels: { title: 'Nueva requisición', titleEdit: 'Editar requisición', subtitle: 'Escribe los insumos que necesitas: quien surte elige de dónde salen' },
            data: {
                sucursales:    app.dataInit.sucursales || [],
                departamentos: [{ id: '', valor: 'Elige el área' }].concat(app.dataInit.departamentos || []),
                unidades:      app.dataInit.unidades || [],
                fecha:         moment().format('YYYY-MM-DD'),
                branch_id:     app.dataInit.askBranchId
            },
            onAdd:    (payload) => this.saveForm(payload),
            onUpdate: (payload) => this.saveForm(payload)
        });

        return this.ordenFormApi;
    }

    openNueva() {
        const form = this.ordenFormInstance();

        form.setMode(null);
        form.setData({ branch_id: app.dataInit.askBranchId, department_id: '', fecha: moment().format('YYYY-MM-DD'), nota: '' });
        form.open();
    }

    // En espera pide contraseña (ya la ve quien surte); el borrador no.
    async openEdit(m) {
        const r = await this.getRequisicion(m.id);
        if (!r) return;

        const h = r.header;

        if (h.status_code === 'EN_ESPERA') {
            const ok = await this.invAskPassword({ url: apiReq, doc: 'req-edit', id: h.id, hint: 'Para editar una requisición ya enviada escribe tu contraseña.' });
            if (!ok) return;
        }

        const catalogo = app.dataInit.productos || [];

        this.ordenFormInstance().openEdit({
            id:            h.id,
            folio:         h.folio,
            status:        h.status_code === 'BORRADOR' ? 'Borrador' : h.status_name,
            branch_id:     h.source_branch_id,
            department_id: h.department_id || '',
            fecha:         h.needed_date || moment().format('YYYY-MM-DD'),
            nota:          h.note || '',
            productos:     (r.detail || []).map((d) => {
                const prod = catalogo.find((p) => String(p.id) === String(d.product_id)) || {};

                return Object.assign({}, prod, {
                    id:        String(d.product_id),
                    nombre:    d.name,
                    sku:       d.sku || '',
                    categoria: prod.categoria || d.category || 'Sin categoría',
                    unit_id:   d.unit_id ? String(d.unit_id) : (prod.unit_id || ''),
                    cantidad:  Number(d.quantity || 0),
                    nota:      d.note || '',
                    stock:     0
                });
            })
        });
    }

    async saveForm(payload) {
        const isEdit = !!payload.id;
        const send   = () => useFetch({
            url:  apiReq,
            data: { opc: isEdit ? 'updateRequisicion' : 'saveRequisicion', payload: JSON.stringify(payload) }
        }).catch(() => null);

        let r = await send();

        // Pasaron los 10 minutos de la contraseña: se pide otra vez y se reintenta.
        if (r && r.status === 403 && isEdit) {
            const ok = await this.invAskPassword({ url: apiReq, doc: 'req-edit', id: payload.id, hint: r.message });
            if (!ok) return;
            r = await send();
        }

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar la requisición' });
            return;
        }

        if (!isEdit && payload.submit) this.avisoEnviada(r, payload);
        else this.alertBox({ type: 'success', title: r.message, timer: 1800 });

        this.refresh(r.id || payload.id);
    }

    // Se queda abierto hasta cerrarlo: folio, a quién, para cuándo y qué lleva.
    avisoEnviada(r, payload) {
        const esc      = invEsc;
        const sucursal = (app.dataInit.sucursales || []).find((s) => String(s.id) === String(payload.destination_branch_id));
        const depto    = (app.dataInit.departamentos || []).find((d) => String(d.id) === String(payload.department_id));
        const units    = (payload.productos || []).reduce((s, p) => s + Number(p.quantity || 0), 0);
        const row      = (k, v) => `<span class="flex justify-between gap-3 py-1 border-b border-gray-100 last:border-b-0"><span class="text-gray-500">${k}</span><span class="font-semibold text-gray-800 text-right">${v}</span></span>`;

        this.alertBox({
            type:       'success',
            title:      `Requisición ${esc(r.folio || '')} enviada`,
            detailHtml: `
                <span class="block mt-2 mb-1 text-left text-[12px]">
                    ${row('Solicitado a', esc(sucursal ? sucursal.valor : '-'))}
                    ${row('Área', esc(depto ? depto.valor : '-'))}
                    ${row('Lo necesitas para', esc(moment(payload.date_order).format('DD/MM/YYYY')))}
                    ${row('Productos', `${(payload.productos || []).length} &middot; ${invQty(units)} uds`)}
                </span>
                <span class="block text-[11px] text-gray-400">Queda en espera de que la surtan.</span>`
        });
    }

    // -- Acciones del visor --

    send(m) {
        this.alertBox({
            type:    'confirm',
            title:   `¿Enviar la requisición ${invEsc(m.folio)}?`,
            detailHtml: `Le llega a <b>${invEsc(m.source_branch)}</b> para que la surta.`,
            okLabel: 'Sí, enviar',
            onOk:    async () => this.done(await useFetch({ url: apiReq, data: { opc: 'sendRequisicion', id: m.id } }), m.id)
        });
    }

    async cancel(m) {
        const reason = await this.invAskReason({
            title:  `Cancelar requisición ${m.folio}`,
            detail: 'Nadie la ha surtido: queda Cancelada y ya no se surte.'
        });
        if (!reason) return;

        this.done(await useFetch({ url: apiReq, data: { opc: 'cancelRequisicion', id: m.id, reason } }), m.id);
    }

    receive(m) {
        const pend = (this.current && this.current.supplies || []).filter((s) => !s.inflow);
        const uds  = pend.reduce((s, x) => s + Number(x.units || 0), 0);

        this.alertBox({
            type:       'confirm',
            title:      '¿Te llegó lo surtido?',
            detailHtml: `Entran <b>${invQty(uds)}</b> unidades de ${pend.length} surtimiento${pend.length === 1 ? '' : 's'} a tu almacén, en una entrada «Surtido de la Matriz».`,
            okLabel:    'Sí, lo recibí',
            onOk:       async () => this.done(await useFetch({ url: apiReq, data: { opc: 'receiveRequisicion', id: m.id } }), m.id)
        });
    }

    async reject(m) {
        const reason = await this.invAskReason({
            title:       `Rechazar requisición ${m.folio}`,
            detail:      `${m.branch} verá el motivo. No sale nada del almacén.`,
            okLabel:     'Sí, rechazar',
            placeholder: '¿Por qué se rechaza?'
        });
        if (!reason) return;

        this.done(await useFetch({ url: apiReq, data: { opc: 'rejectRequisicion', id: m.id, reason } }), m.id);
    }

    async revert(m) {
        const ok = await this.invAskPassword({ url: apiReq, doc: 'req-revert', id: m.id, hint: 'Para revertir lo surtido escribe tu contraseña.' });
        if (!ok) return;

        const reason = await this.invAskReason({
            title:       `Revertir el surtido de ${m.folio}`,
            detail:      'Lo surtido que aún no reciben regresa a tu almacén (la salida se cancela). Lo ya recibido no se toca.',
            okLabel:     'Sí, revertir',
            placeholder: '¿Por qué se revierte?'
        });
        if (!reason) return;

        this.done(await useFetch({ url: apiReq, data: { opc: 'revertSurtido', id: m.id, reason } }), m.id);
    }

    done(r, id) {
        if (r && r.status === 200) {
            this.alertBox({ type: 'success', title: r.message, timer: 2200 });
            this.refresh(id);
        } else {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo completar' });
        }
    }

    async print(m) {
        const w = window.open('', '_blank', 'width=900,height=1000');
        const r = await useFetch({ url: apiReq, data: { opc: 'printRequisicion', id: m.id } });

        if (!(r && r.status === 200)) {
            if (w) w.close();
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo imprimir' });
            return;
        }

        if (!w) {
            this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' });
            return;
        }

        w.document.write(r.html);
        w.document.close();
        w.focus();
    }

    // La pestaña se abre en el clic (antes del fetch) para que no la bloquee el navegador.
    async share(m) {
        const w = window.open('', '_blank');
        const r = await useFetch({ url: apiReq, data: { opc: 'shareRequisicion', id: m.id } });

        if (!(r && r.status === 200 && r.token)) {
            if (w) w.close();
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo crear el enlace' });
            return;
        }

        const url  = new URL('comprobante-requisicion.php?t=' + r.token, location.href).href;
        const text = `Requisición ${r.folio} de ${r.branch}: ${url}`;
        const wa   = 'https://wa.me/?text=' + encodeURIComponent(text);

        if (w) w.location.href = wa;
        else window.location.href = wa;
    }

    // -- Surtir (quien surte) --

    async openSurtir(m) {
        const r = await useFetch({ url: apiReq, data: { opc: 'getSurtido', id: m.id } });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo abrir el surtido' });
            return;
        }

        requisicionesView.surtidoModal(r, (data) => this.supply(m, data));
    }

    async supply(m, data) {
        const r = await useFetch({
            url:  apiReq,
            data: { opc: 'supplyRequisicion', id: m.id, warehouse_id: data.warehouse_id, note: data.note, finish: data.finish ? 1 : 0, items: JSON.stringify(data.items) }
        }).catch(() => null);

        if (r && r.status === 200) {
            $('#modalSurtido').remove();
            this.alertBox({ type: 'success', title: r.message, timer: 2600 });
            this.refresh(m.id);
            return;
        }

        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo surtir' });
    }
}

class RequisicionesView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'requisiciones';
    }

    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            json:   Object.assign({}, VIEW_HEADER_REQ, { titleHtml: invTitleHtml(VIEW_HEADER_REQ.title, app.dataInit.branch) })
        });

        // Lista | Calendario, a la derecha del título.
        const btn = 'px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors';

        $('#viewHeader > div').first().after(`
            <div class="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 flex-shrink-0">
                <button type="button" data-req-vista="lista" class="${btn} bg-white text-gray-800 shadow-sm"><i data-lucide="list" class="w-3.5 h-3.5"></i>Lista</button>
                <button type="button" data-req-vista="calendario" class="${btn} text-gray-500"><i data-lucide="calendar-days" class="w-3.5 h-3.5"></i>Calendario</button>
            </div>
        `);

        $('[data-req-vista]').on('click', (e) => app.setVista($(e.currentTarget).attr('data-req-vista')));

        if (window.lucide) lucide.createIcons();
    }

    // Los estados con su ícono y color (Catálogo de insumos › Estados de requisición).
    renderLegend() {
        const chips = (app.dataInit.estados || []).filter((e) => e.id).map((e) => {
            const fg = e.color || 'rgb(var(--brand-600, 192 90 64))';

            return `<span class="inline-flex items-center gap-1 text-[11px] font-semibold" style="color:${invEsc(fg)}">
                        <i data-lucide="${invEsc(e.icon || 'circle')}" class="w-3.5 h-3.5"></i>${invEsc(e.valor)}
                    </span>`;
        }).join('<span class="text-gray-300">·</span>');

        $('#kpisRow').removeClass('py-3').addClass('py-2').html(`<div class="flex flex-wrap items-center gap-x-3 gap-y-1">${chips}</div>`);

        if (window.lucide) lucide.createIcons();
    }

    renderDetail(r) {
        this.reqDetailPanel({
            parent: 'detailPanel',
            json:   r,
            onClose:   () => app.selectRequisicion(null),
            onEdit:    (m) => requisiciones.openEdit(m),
            onSend:    (m) => requisiciones.send(m),
            onCancel:  (m) => requisiciones.cancel(m),
            onReceive: (m) => requisiciones.receive(m),
            onSupply:  (m) => requisiciones.openSurtir(m),
            onReject:  (m) => requisiciones.reject(m),
            onRevert:  (m) => requisiciones.revert(m),
            onPrint:   (m) => requisiciones.print(m),
            onShare:   (m) => requisiciones.share(m)
        });

        invToggleVisor(!!r);
    }

    // -- Visor de la derecha --

    reqDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'reqDetailPanel',
            class:  'flex-1 min-h-0 flex flex-col overflow-hidden',
            json:   null,
            onClose: () => {}, onEdit: () => {}, onSend: () => {}, onCancel: () => {}, onReceive: () => {},
            onSupply: () => {}, onReject: () => {}, onRevert: () => {}, onPrint: () => {}, onShare: () => {}
        };

        const opts    = Object.assign({}, defaults, options || {});
        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc   = invEsc;
        const r     = opts.json;
        const fecha = (d) => d ? moment(d).format('DD/MM/YYYY') : '-';
        const hora  = (d) => d ? moment(d).format('DD/MM/YYYY hh:mm a') : '-';
        const infoRow = (label, value) => `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">${esc(label)}</span>${value}</div>`;
        const text    = (value) => `<span class="text-gray-700 text-right">${esc(value || '-')}</span>`;

        if (!r) {
            $parent.html(`
                <aside id="${opts.id}" class="${opts.class}">
                    <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                        <i data-lucide="clipboard-list" class="w-10 h-10 text-gray-300 mb-3"></i>
                        <p class="text-sm font-semibold text-gray-500">Selecciona una requisición</p>
                        <p class="text-xs text-gray-400 mt-1 max-w-[220px]">Haz clic en el folio o en el ojo para ver el detalle aquí.</p>
                    </div>
                </aside>`);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const h     = r.header;
        const p     = r.perms || {};
        const costs = !!r.costs;
        const code  = h.status_code;

        // Paso a paso: En espera · [Surtido parcialmente] · Entregado · Confirmado.
        const parcial = code === 'SURTIDO_PARCIAL' || (r.supplies || []).length > 1;
        const pasos   = [['EN_ESPERA', 'En espera']].concat(parcial ? [['SURTIDO_PARCIAL', 'Parcial']] : [], [['ENTREGADO', 'Entregado'], ['CONFIRMADO', 'Confirmado']]);
        const orden   = pasos.map((x) => x[0]);
        const actual  = orden.indexOf(code);
        const stepper = ['RECHAZADA', 'CANCELADA', 'BORRADOR'].includes(code) ? '' : `
            <div class="px-4 py-2.5 border-b border-gray-200 dark:!border-0 flex items-center gap-1 flex-shrink-0">
                ${pasos.map((x, i) => {
                    const done = i <= actual;
                    return `<div class="flex items-center gap-1 ${i < pasos.length - 1 ? 'flex-1' : ''}">
                        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? 'text-white' : 'bg-gray-100 text-gray-400'}" style="${done ? 'background:rgb(var(--brand-600, 192 90 64))' : ''}">${i + 1}</span>
                        <span class="text-[10px] font-semibold whitespace-nowrap ${done ? 'text-gray-700' : 'text-gray-400'}">${esc(x[1])}</span>
                        ${i < pasos.length - 1 ? `<span class="flex-1 h-px mx-1 ${i < actual ? '' : 'bg-gray-200'}" style="${i < actual ? 'background:rgb(var(--brand-600, 192 90 64))' : ''}"></span>` : ''}
                    </div>`;
                }).join('')}
            </div>`;

        const rows = (r.detail || []).map((d) => {
            const full = Number(d.quantity_supplied) + 0.00001 >= Number(d.quantity);
            return `
                <tr class="border-b border-gray-100 last:border-b-0 align-top">
                    <td class="!py-1 !pl-2 !pr-2">
                        <p class="text-[11px] font-medium text-gray-700 leading-tight">${esc(d.name)}${d.sku ? ` <span class="text-[10px] font-normal text-gray-400">${esc(d.sku)}</span>` : ''}</p>
                        ${d.note ? `<p class="text-[10px] text-gray-400 leading-tight mt-0.5">${esc(d.note)}</p>` : ''}
                    </td>
                    <td class="!py-1 !px-1 text-center text-[11px] font-semibold text-gray-800">${invQty(d.quantity)}</td>
                    <td class="!py-1 !px-1 text-center text-[11px] font-semibold ${full ? 'text-green-600' : Number(d.quantity_supplied) > 0 ? 'text-amber-600' : 'text-gray-400'}">${invQty(d.quantity_supplied)}</td>
                    <td class="!py-1 !px-1 text-center text-[11px] text-gray-500">${esc(d.unit)}</td>
                    ${costs ? `<td class="!py-1 !pl-1 !pr-2 text-right text-[11px] text-gray-700 whitespace-nowrap">${invMoney(Number(d.quantity) * Number(d.cost))}</td>` : ''}
                </tr>`;
        }).join('');

        const supplies = (r.supplies || []).map((s) => `
            <div class="py-1.5 border-b border-gray-100 last:border-b-0 text-[11px]">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-gray-700">${esc(hora(s.created_at))}</span>
                    ${s.inflow
                        ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Recibido · ${esc(s.inflow)}</span>`
                        : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">Por recibir</span>'}
                </div>
                <p class="text-gray-500">${esc(s.user_name)} · ${esc(s.warehouse)} · ${s.products} producto${s.products === 1 ? '' : 's'} · ${invQty(s.units)} uds${costs && s.cost ? ' · ' + invMoney(s.cost) : ''}${s.outflow ? ' · ' + esc(s.outflow) : ''}</p>
                ${s.note ? `<p class="text-gray-400 italic">${esc(s.note)}</p>` : ''}
            </div>`).join('');

        const actions = [];
        const btnOut  = 'flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 rounded-lg border-[1px] border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center gap-1.5';
        const btnMain = 'flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 hover:opacity-90';
        const btnRed  = 'flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5';
        const brand   = 'style="background:rgb(var(--brand-600, 192 90 64))"';

        if (p.edit)    actions.push(`<button data-act="edit" class="${btnOut}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button>`);
        if (p.send)    actions.push(`<button data-act="send" class="${btnMain}" ${brand}><i data-lucide="send" class="w-3.5 h-3.5"></i>Enviar</button>`);
        if (p.receive) actions.push(`<button data-act="receive" class="${btnMain}" ${brand}><i data-lucide="package-check" class="w-3.5 h-3.5"></i>Recibí</button>`);
        if (p.supply)  actions.push(`<button data-act="supply" class="${btnMain}" ${brand}><i data-lucide="truck" class="w-3.5 h-3.5"></i>Surtir</button>`);
        if (p.revert)  actions.push(`<button data-act="revert" class="${btnOut}"><i data-lucide="undo-2" class="w-3.5 h-3.5"></i>Revertir</button>`);
        if (p.reject)  actions.push(`<button data-act="reject" class="${btnRed}"><i data-lucide="circle-x" class="w-3.5 h-3.5"></i>Rechazar</button>`);
        if (p.cancel)  actions.push(`<button data-act="cancel" class="${btnRed}"><i data-lucide="ban" class="w-3.5 h-3.5"></i>Cancelar</button>`);

        const iconBtn = 'w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors';

        $parent.html(`
            <aside id="${opts.id}" class="${opts.class}">
                <div class="flex-1 flex flex-col overflow-hidden">
                    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 dark:!border-0 flex items-center justify-between flex-shrink-0">
                        <div>
                            <p class="text-xs text-gray-500 uppercase tracking-wider">Detalle de la requisición</p>
                            <p class="text-base font-bold text-gray-800 whitespace-nowrap">${esc(h.folio)}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="whitespace-nowrap">${h.status_badge || ''}</span>
                            <button data-act="share" class="${iconBtn}" aria-label="Compartir por WhatsApp"><i data-lucide="share-2" class="w-3.5 h-3.5"></i></button>
                            ${p.print ? `<button data-act="print" class="${iconBtn}" aria-label="Imprimir"><i data-lucide="printer" class="w-3.5 h-3.5"></i></button>` : ''}
                            <button data-act="close" class="${iconBtn}" aria-label="Cerrar"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>

                    ${stepper}

                    <div class="px-4 py-3 border-b border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                        ${infoRow('Pide', text(h.branch))}
                        ${infoRow('Surte', text(h.source_branch))}
                        ${infoRow('Área', h.department_pill || text('-'))}
                        ${infoRow('Lo necesita', text(fecha(h.needed_date)))}
                        ${infoRow('Creada', text(hora(h.created_at)))}
                    </div>

                    <div class="flex-1 overflow-y-auto px-4 py-2">
                        <p class="text-xs uppercase tracking-wider text-gray-500 mb-1">Productos (${(r.detail || []).length})</p>
                        <div class="rounded-lg overflow-hidden border border-gray-200 dark:!border-0">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                                        <th class="text-left font-semibold text-[10px] !py-1.5 !pl-2 !pr-2">Producto</th>
                                        <th class="text-center font-semibold text-[10px] !py-1.5 !px-1">Pedido</th>
                                        <th class="text-center font-semibold text-[10px] !py-1.5 !px-1">Surtido</th>
                                        <th class="text-center font-semibold text-[10px] !py-1.5 !px-1">Unidad</th>
                                        ${costs ? '<th class="text-right font-semibold text-[10px] !py-1.5 !pl-1 !pr-2">Importe</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${costs ? 5 : 4}" class="py-2 text-center text-xs text-gray-400">Sin productos</td></tr>`}</tbody>
                            </table>
                        </div>
                        ${supplies ? `<p class="text-xs uppercase tracking-wider text-gray-500 mt-3 mb-1">Surtimientos</p><div>${supplies}</div>` : ''}
                    </div>

                    <div class="cs-visor-totals px-4 py-2.5 border-t border-gray-200 dark:!border-0 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center justify-between ${costs ? 'text-xs text-gray-500 mb-1' : ''}">
                            <span class="${costs ? '' : 'text-sm font-semibold text-gray-700'}">Unidades</span>
                            <span class="${costs ? 'font-semibold text-gray-700' : 'text-lg font-bold text-gray-800'}">${invQty(h.total_units)}</span>
                        </div>
                        ${costs ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-semibold text-gray-700">Importe estimado</span>
                            <span class="text-lg font-bold text-gray-800">${invMoney(h.total_cost)}</span>
                        </div>` : ''}
                    </div>

                    <div class="px-4 py-2.5 border-t border-gray-200 dark:!border-0 flex-shrink-0 space-y-1.5">
                        ${infoRow('Solicitó', text(h.user_name))}
                        ${h.approved_name ? infoRow(code === 'RECHAZADA' ? 'Rechazó' : 'Surtió', text(`${h.approved_name} · ${hora(h.approved_at)}`)) : ''}
                        ${h.confirmed_name ? infoRow('Confirmó', text(`${h.confirmed_name} · ${hora(h.confirmed_at)}`)) : ''}
                        ${h.note ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">Nota</span>${text(h.note)}</div>` : ''}
                        ${h.approval_note ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">Nota de surtido</span>${text(h.approval_note)}</div>` : ''}
                        ${h.reject_reason ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-24 flex-shrink-0">Motivo</span>${text(h.reject_reason)}</div>` : ''}
                    </div>

                    ${actions.length ? `<div class="px-4 py-3 border-t border-gray-200 dark:!border-0 flex gap-2 flex-shrink-0">${actions.join('')}</div>` : ''}
                </div>
            </aside>
        `);

        if (window.lucide) lucide.createIcons();

        const m = Object.assign({}, h);
        const map = {
            close: opts.onClose, edit: opts.onEdit, send: opts.onSend, cancel: opts.onCancel, receive: opts.onReceive,
            supply: opts.onSupply, reject: opts.onReject, revert: opts.onRevert, print: opts.onPrint, share: opts.onShare
        };

        $parent.find('[data-act]').on('click', (e) => {
            const fn = map[$(e.currentTarget).attr('data-act')];
            if (fn) fn(m);
        });
    }

    // -- «Surtiendo la requisición» --
    // Almacén (con lo que hay de cada producto), cuánto sale de cada uno (lo pendiente,
    // topado a lo que hay) y la nota. «Dar por terminada»: lo que falta ya no se surte.

    surtidoModal(r, onConfirm) {
        const esc       = invEsc;
        const id        = 'modalSurtido';
        const h         = r.header;
        const almacenes = app.dataInit.almacenes || [];
        const stock     = r.stock || {};
        const lines     = (r.detail || []).map((d) => Object.assign({}, d, { pending: Math.max(0, Number(d.quantity) - Number(d.quantity_supplied)) }));
        const brand     = 'rgb(var(--brand-600, 192 90 64))';
        const th        = 'px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold';

        $(`#${id}`).remove();

        const $modal = $(`
            <div id="${id}" class="fixed inset-0 z-[9990] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40" data-close></div>
                <div class="relative z-10 w-full max-w-[960px] max-h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${brand}"><i data-lucide="truck" class="w-5 h-5 text-white"></i></div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">Surtiendo la requisición ${esc(h.folio)}</h3>
                                <p class="text-[11px] text-gray-500">Pide <b class="text-gray-700">${esc(h.branch)}</b>${h.department ? ' · ' + esc(h.department) : ''} · Lo necesita ${h.needed_date ? esc(moment(h.needed_date).format('DD/MM/YYYY')) : '-'}</p>
                            </div>
                        </div>
                        <button data-close class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>

                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid ${brand};background:rgb(var(--brand-600, 192 90 64) / .05)">
                            <i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:${brand}"></i>
                            <p class="text-[11px] text-gray-600 leading-relaxed">Lo que surtas sale ahora de tu almacén en una <b class="text-gray-800">salida</b> «Surtido a sucursal». Entra al almacén de ${esc(h.branch)} cuando confirme «Recibí». Lo que no surtas queda pendiente.</p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sale del almacén</label>
                                <select id="${id}_wh" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md">
                                    ${almacenes.map((a) => `<option value="${a.id}">${esc(a.valor)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">¿Por qué no se surtió completo? <span class="normal-case text-gray-400">(opcional)</span></label>
                                <input id="${id}_note" type="text" maxlength="255" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md" placeholder="No había suficiente, se surte mañana...">
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="${th} text-left">Producto</th>
                                    <th class="${th} text-center w-20">Pedido</th>
                                    <th class="${th} text-center w-20">Surtido</th>
                                    <th class="${th} text-center w-20">Falta</th>
                                    <th class="${th} text-center w-20">Hay</th>
                                    <th class="${th} text-center w-28">A surtir</th>
                                    <th class="${th} text-center w-20">Unidad</th>
                                </tr>
                            </thead>
                            <tbody id="${id}_body" class="divide-y divide-gray-100"></tbody>
                        </table>
                    </div>

                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <label class="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer select-none">
                            <input id="${id}_finish" type="checkbox" class="w-4 h-4">Dar por terminada: lo que falte ya no se surte
                        </label>
                        <div class="flex items-center gap-3">
                            <span class="text-[11px] text-gray-500">A surtir <strong id="${id}_tot" class="text-gray-800 text-sm">0</strong> uds</span>
                            <button data-close class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cancelar</button>
                            <button id="${id}_ok" class="px-3 py-1.5 text-xs font-bold text-white rounded-md flex items-center gap-1.5" style="background:${brand}"><i data-lucide="truck" class="w-3.5 h-3.5"></i>Surtir</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);

        const paint = () => {
            const whStock = stock[$(`#${id}_wh`).val()] || {};

            $(`#${id}_body`).html(lines.map((d) => {
                const hay  = Number(whStock[String(d.product_id)] || 0);
                const sug  = Math.max(0, Math.min(d.pending, hay));
                const step = Number(d.decimals) ? '0.001' : '1';

                return `
                    <tr data-detail="${d.id}">
                        <td class="px-3 py-2">
                            <p class="text-xs font-medium text-gray-700">${esc(d.name)}</p>
                            ${d.note ? `<p class="text-[10px] text-gray-400">${esc(d.note)}</p>` : ''}
                        </td>
                        <td class="px-3 py-2 text-center text-xs text-gray-600">${invQty(d.quantity)}</td>
                        <td class="px-3 py-2 text-center text-xs font-semibold ${Number(d.quantity_supplied) > 0 ? 'text-green-600' : 'text-gray-400'}">${invQty(d.quantity_supplied)}</td>
                        <td class="px-3 py-2 text-center text-xs font-semibold text-gray-800">${invQty(d.pending)}</td>
                        <td class="px-3 py-2 text-center text-xs font-bold ${hay < d.pending ? 'text-orange-500' : 'text-green-600'}">${invQty(hay)}</td>
                        <td class="px-3 py-2">
                            <input type="number" min="0" max="${d.pending}" step="${step}" value="${d.pending > 0 ? sug : 0}" ${d.pending > 0 ? '' : 'disabled'}
                                class="req-qty w-full px-2 py-1 text-xs font-bold text-center text-gray-800 bg-white border border-gray-300 rounded ${d.pending > 0 ? '' : 'bg-gray-100 text-gray-400'}">
                        </td>
                        <td class="px-3 py-2 text-center text-xs text-gray-500">${esc(d.unit)}</td>
                    </tr>`;
            }).join(''));

            total();
        };

        const total = () => {
            let t = 0;
            $modal.find('.req-qty').each(function () { t += Number($(this).val()) || 0; });
            $(`#${id}_tot`).text(invQty(t));
        };

        $modal.on('input', '.req-qty', function () {
            const max = Number($(this).attr('max')) || 0;
            if (Number($(this).val()) > max) $(this).val(max);
            if (Number($(this).val()) < 0) $(this).val(0);
            total();
        });

        $(`#${id}_wh`).on('change', paint);
        $modal.find('[data-close]').on('click', () => $modal.remove());

        $(`#${id}_ok`).on('click', () => {
            const items = {};

            $modal.find(`#${id}_body tr`).each(function () {
                const q = Number($(this).find('.req-qty').val()) || 0;
                if (q > 0) items[$(this).attr('data-detail')] = q;
            });

            const finish = $(`#${id}_finish`).is(':checked');

            if (!Object.keys(items).length && !finish) {
                this.alertBox({ type: 'warning', title: 'Escribe cuánto surtes de al menos un producto.' });
                return;
            }

            onConfirm({ warehouse_id: $(`#${id}_wh`).val(), note: $(`#${id}_note`).val() || '', finish, items });
        });

        paint();
        if (window.lucide) lucide.createIcons();
    }
}

// -- Pestaña Calendario: cada requisición en el día en que se necesita --

class CalendarioReq extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.cal = null;
    }

    render() {
        if (typeof FullCalendar === 'undefined') {
            $('#calendarWrap').html('<p class="text-xs text-gray-400 text-center py-10">No se pudo cargar el calendario (sin conexión a internet).</p>');
            return;
        }

        if (this.cal) { this.cal.updateSize(); this.reload(); return; }

        $('#calendarWrap').html('<div id="reqCalendar" class="min-h-[560px]"></div>');

        this.cal = new FullCalendar.Calendar(document.getElementById('reqCalendar'), {
            initialView:   'dayGridMonth',
            locale:        'es',
            firstDay:      1,
            height:        'auto',
            buttonText:    { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' },
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' },
            dayMaxEvents:  4,
            events:        (info, success, failure) => this.lsEvents(info, success, failure),
            eventClick:    (info) => {
                info.jsEvent.preventDefault();
                app.setVista('lista');
                app.selectRequisicion(Number(info.event.id));
            }
        });

        this.cal.render();
    }

    async lsEvents(info, success, failure) {
        const r = await useFetch({ url: apiReq, data: { opc: 'lsCalendario', start: info.startStr, end: info.endStr } }).catch(() => null);

        if (r && r.status === 200) success(r.events || []);
        else failure(new Error((r && r.message) || 'Sin eventos'));
    }

    reload() {
        if (this.cal) this.cal.refetchEvents();
    }
}
