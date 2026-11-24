// -- Traspasos --
// Mercancía que va de un almacén a otro de la empresa. El origen lo envía y
// no se mueve nada; el destino lo recibe con lo que llegó: en ese momento resta
// de allá y suma aquí. O lo rechaza. El origen lo cancela mientras nadie lo recibe.
// Ayudantes (notify, esc, InvPage, InvGrid) en inventarios.js.

let traspasos;

$(() => {
    traspasos = new Transfers('ctrl/ctrl-traspasos.php', 'root');
    traspasos.init();
});

class Transfers extends InvPage {

    constructor(link, div_modulo) {
        super(link, div_modulo, {
            name: 'Transfers',
            title: 'Traspasos',
            help: 'Mercancía que va de un almacén a otro de la empresa',
            tabKey: 'inventarios:traspasos:tab:v1'
        });
        this.grid  = null;
        this.items = [];
    }

    tabsList() {
        return [
            { id: 'out', tab: 'Enviados', icon: 'send', render: () => this.renderTab('out'), reopen: () => this.ls('out') },
            { id: 'pending', tab: 'Por recibir', icon: 'package-check', render: () => this.renderTab('pending'), reopen: () => this.ls('pending') },
            { id: 'in', tab: 'Recibidos', icon: 'archive', render: () => this.renderTab('in'), reopen: () => this.ls('in') }
        ];
    }

    // [sufijo de los ids, prefijo del filtro] de cada pestaña.
    keys(tab) {
        return { out: ['Out', 'tro_'], pending: ['Pending', 'trp_'], in: ['In', 'tri_'] }[tab];
    }

    // -- Listas --

    // Las tres son la misma lista: Por recibir no lleva fechas (todo lo que espera).
    renderTab(tab) {
        const [key, prefix] = this.keys(tab);

        $(`#container-${tab}`).html(`
            <div id="filterBarTr${key}" class="mb-[8px]"></div>
            <div id="summaryTr${key}" class="inv-resumen"></div>
            <div id="containerTr${key}"></div>
        `);

        const statuses = tab === 'out'
            ? [{ id: 'REQUESTED', valor: 'Enviados' }, { id: 'RECEIVED', valor: 'Entregados' }]
            : [{ id: 'RECEIVED', valor: 'Recibidos' }];
        const data     = [];

        if (tab !== 'pending') {
            data.push(
                { opc: 'input-calendar', id: 'calendar', lbl: 'Periodo', required: false, readonly: true, class: 'col-12 col-lg-3' },
                {
                    opc: 'select', id: 'status', lbl: 'Estado', required: false, class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, ...statuses, { id: 'REJECTED', valor: 'Rechazados' }, { id: 'CANCELLED', valor: 'Cancelados' }],
                    onchange: `traspasos.ls('${tab}')`
                }
            );
        }

        if (tab === 'out' && this.can('create')) {
            data.push({ opc: 'button', id: 'btnNewTransfer', class: 'col-12 col-lg-2', text: 'Nuevo traspaso', onClick: () => this.add() });
        }

        this.createfilterBar({ parent: `filterBarTr${key}`, id: `fbTr${key}`, prefijo: prefix, coffeesoft: true, data });

        if (tab !== 'pending') this.periodPicker(`${prefix}calendar`, () => this.ls(tab));

        this.ls(tab);
    }

    // Columnas: Folio, Fecha, Origen, Destino, Productos [, Importe], Estado, Envió, Recibió
    ls(tab) {
        const [key, prefix] = this.keys(tab);

        this.table({
            parent: `containerTr${key}`,
            filterBar: `filterBarTr${key}`,
            id: `tbTr${key}`,
            data: { opc: 'lsTransfers', tab, ...(tab === 'pending' ? {} : this.periodData(`${prefix}calendar`)) },
            ...(this.costs ? { right: [6], center: [2, 5, 7] } : { right: [], center: [2, 5, 6] }),
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                const s = data.summary || {};

                this.csTabCount('pending', data.pending);
                this.paintSummary(`summaryTr${key}`, [
                    { html: `<b>${s.docs || 0}</b> ${s.docs === 1 ? 'traspaso' : 'traspasos'}${tab === 'pending' ? ' por recibir' : ''}`, tone: tab === 'pending' && s.docs ? 'amber' : '' },
                    s.total !== undefined ? { html: `Importe <b>${money(s.total)}</b>` } : null
                ]);
            }
        });
    }

    reload() {
        ['out', 'pending', 'in'].forEach((tab) => {
            if (this.opened[tab]) this.ls(tab);
        });
    }

    // -- Enviar --

    async add() {
        const o = await useFetch({ url: this._link, data: { opc: 'formOptions' } });

        if (!o || o.status != 200) return notify(o);

        const origins = o.warehouses || [];
        const others  = (o.destinations || []).filter((d) => !origins.some((w) => String(w.id) === String(d.id)));

        if (!others.length && origins.length < 2) {
            return warnBox('La empresa tiene un solo almacén: para traspasar hace falta otra sucursal u otro almacén.');
        }

        const half = 'w-full sm:w-1/2';

        this.options = o;
        this.grid    = new InvGrid({
            modal: 'modalTransfer',
            mode: 'out',
            products: o.products,
            costs: o.costs,
            warehouseId: () => $('#modalTransfer #warehouse_id').val(),
            date: () => ''
        });

        this.csModal({
            id: 'modalTransfer',
            title: 'Nuevo traspaso',
            subtitle: 'Se mueve cuando el destino lo recibe',
            lucideIcon: 'arrow-right-left',
            width: 'max-w-5xl',
            saveText: 'Enviar traspaso',
            json: [
                { id: 'warehouse_id', lbl: 'Sale de', tipo: 'select', empty: false, class: half, data: origins },
                { id: 'destination', lbl: 'Va a', tipo: 'select', empty: 'Elige el almacén', class: half, data: [] },
                { id: 'routeNote', tipo: 'html', class: 'w-full', html: '<p class="inv-aviso" id="transferNote"></p>' },
                { id: 'gridField', tipo: 'html', class: 'w-full', html: this.grid.html() },
                { id: 'note', lbl: 'Nota', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Opcional: quién lo lleva, para qué es', class: 'w-full' }
            ],
            onSave: (values, close) => this.save(values, close)
        });

        this.grid.bind();
        this.bindRoute();
    }

    // «Va a» nunca ofrece el almacén de donde sale; el aviso dice qué pasa al recibir.
    bindRoute() {
        const modal  = $('#modalTransfer');
        const origin = modal.find('#warehouse_id');
        const dest   = modal.find('#destination');

        const note = () => {
            const from = origin.find('option:selected').text();
            const to   = dest.val() ? dest.find('option:selected').text() : '';

            modal.find('#transferNote').text(to
                ? `Sale de ${from} y entra a ${to} cuando allá lo reciban. Mientras, no se mueve nada.`
                : 'No se mueve nada hasta que el destino lo reciba: entonces resta de aquí y suma allá.');
        };

        const fill = () => {
            const current = String(dest.val() || '');
            const list    = (this.options.destinations || []).filter((d) => String(d.id) !== String(origin.val()));

            dest.empty().append($('<option>', { value: '', text: 'Elige el almacén' }));
            list.forEach((d) => dest.append($('<option>', { value: d.id, text: d.valor })));

            if (list.some((d) => String(d.id) === current)) dest.val(current);
            else if (list.length === 1) dest.val(String(list[0].id));

            note();
        };

        modal.on('change', '#warehouse_id', () => {
            fill();
            this.grid.refresh();
        });
        modal.on('change', '#destination', note);

        fill();
    }

    save(values, close) {
        if (!values.destination) return warnBox('Elige a dónde va.');

        const grid = this.grid.lines();

        if (grid.error) return warnBox(grid.error);

        const short = this.grid.draft.find((d) => {
            const p = this.grid.products.find((x) => x.id === d.id) || {};
            return d.quantity > this.grid.have(p) + 0.00001;
        });

        if (short) return warnBox(`No hay suficiente «${short.name}» en el almacén de donde sale.`);

        return saveFrom('modalTransfer', async () => {
            const r = await useFetch({
                url: this._link,
                data: { opc: 'addTransfer', warehouse_id: values.warehouse_id, destination: values.destination, note: values.note || '', lines: JSON.stringify(grid.lines) }
            });

            notify(r);

            if (r && r.status == 200) {
                close();
                this.reload();
            }
        });
    }

    // -- Detalle --

    async show(id) {
        const r = await useFetch({ url: this._link, data: { opc: 'getTransfer', id } });

        if (!r || r.status != 200) return notify(r);

        const d     = r.data;
        const done  = d.status_code === 'RECEIVED';
        const costs = this.costs;
        const cols  = 3 + (done ? 1 : 0) + (costs ? 2 : 0) + (done ? 2 : 0);

        // Clave, Producto, Enviado [, Recibido] [, Costo, Importe] [, Origen, Destino]: de Enviado en adelante, a la derecha.
        this.detail({
            id: 'modalTransferDetail',
            title: `Traspaso ${d.folio}`,
            subtitle: `${d.origin} → ${d.destination}`,
            icon: 'arrow-right-left',
            warn: this.warnText(d),
            top: this.route(d),
            info: [
                ['Estado', this.chip(d.status, d.status_color)],
                ['Envió', `${esc(d.user)} <small>${esc(d.created)}</small>`],
                ['Recibió', d.received ? `${esc(d.receiver)} <small>${esc(d.received)}</small>` : ''],
                ['Productos', String(d.products)],
                ['Importe', d.total !== null ? money(d.total) : ''],
                ['Nota', d.note ? esc(d.note) : '']
            ],
            lines: r.lines || [],
            right: Array.from({ length: cols - 2 }, (_, i) => i + 3),
            extra: this.history(r.history || []),
            save: d.can_receive ? { text: 'Recibir', onSave: (close) => { close(); this.receive(d.id); } } : null,
            action: d.can_reject
                ? { text: 'Rechazar', lucideIcon: 'circle-x', onClick: () => { $('#modalTransferDetail .cs-modal-x').trigger('click'); this.reject(d.id, d.folio); } }
                : (d.can_cancel ? { text: 'Cancelar', lucideIcon: 'ban', onClick: () => { $('#modalTransferDetail .cs-modal-x').trigger('click'); this.cancel(d.id, d.folio); } } : null)
        });
    }

    warnText(d) {
        switch (d.status_code) {
            case 'REQUESTED':
                return d.is_destination
                    ? 'Por recibir: cuenta lo que llegó y pulsa «Recibir». Hasta entonces no se mueve nada.'
                    : 'Enviado: se mueve cuando el destino lo reciba.';
            case 'REJECTED':  return `Rechazado: ${esc(d.reject_reason || '')}. No se movió nada.`;
            case 'CANCELLED': return `Cancelado: ${esc(d.reject_reason || '')}. No se movió nada.`;
            default:          return d.receive_note ? `Al recibir: ${esc(d.receive_note)}` : '';
        }
    }

    // De dónde sale y a dónde va, arriba de los datos.
    route(d) {
        const side = (label, name, branch, mine) => `
            <div class="inv-ruta-lado${mine ? ' es-mia' : ''}">
                <span>${label}</span>
                <b>${esc(name)}</b>
                <small>${mine ? 'Esta sucursal' : esc(branch)}</small>
            </div>`;

        return `
            <div class="inv-ruta">
                ${side('Sale de', d.origin, d.origin_branch, d.is_origin)}
                <i data-lucide="arrow-right" class="inv-ruta-flecha"></i>
                ${side('Va a', d.destination, d.destination_branch, d.is_destination)}
            </div>`;
    }

    chip(text, color) {
        const hex = /^#[0-9A-Fa-f]{6}$/.test(String(color || '')) ? color : '#64748B';

        return `<span class="cp-chip" style="background:${hex}1A;color:${hex}">${esc(text)}</span>`;
    }

    // Cada cambio de estado, del primero al último.
    history(list) {
        if (!list.length) return '';

        const names = { REQUESTED: 'Enviado', RECEIVED: 'Recibido', REJECTED: 'Rechazado', CANCELLED: 'Cancelado' };
        const items = list.map((h) => {
            const hex = /^#[0-9A-Fa-f]{6}$/.test(String(h.color || '')) ? h.color : '#64748B';

            return `
                <li>
                    <span class="inv-historial-punto" style="background:${hex}"></span>
                    <div>
                        <b>${esc(names[h.code] || h.status)}</b>
                        <small>${esc(h.when)} · ${esc(h.user)}</small>
                        ${h.note ? `<p>${esc(h.note)}</p>` : ''}
                    </div>
                </li>`;
        }).join('');

        return `<div class="inv-historial"><span class="inv-historial-titulo">Historial</span><ul>${items}</ul></div>`;
    }

    // -- Recibir --

    async receive(id) {
        const r = await useFetch({ url: this._link, data: { opc: 'getTransfer', id } });

        if (!r || r.status != 200) return notify(r);

        const d = r.data;

        if (!d.can_receive) return warnBox(`El traspaso ${d.folio} ya está ${String(d.status || '').toLowerCase()}.`);

        this.items = r.items || [];

        const rows = this.items.map((it, i) => `
            <tr>
                <td class="cp-rej-clave">${esc(it.sku) || '—'}</td>
                <td>${esc(it.name)}</td>
                <td class="n">${qtyText(it.quantity)} <span class="cp-celda-sub">${esc(it.unit)}</span></td>
                <td class="ed"><input type="number" class="inv-rej-campo n" data-index="${i}" min="0" max="${it.quantity}"
                    step="${it.decimals ? '0.001' : '1'}" value="${it.quantity}" aria-label="Recibido de ${esc(it.name)}"></td>
                <td class="n inv-rec-falta"><span class="cp-celda-sub">—</span></td>
            </tr>`).join('');

        this.csModal({
            id: 'modalReceive',
            title: `Recibir ${d.folio}`,
            subtitle: `${d.origin} → ${d.destination}`,
            lucideIcon: 'package-check',
            width: 'max-w-3xl',
            saveText: 'Recibir',
            json: [
                {
                    id: 'receiveInfo', tipo: 'html', class: 'w-full',
                    html: `<p class="inv-aviso">Cuenta lo que llegó. Al recibir, sale de ${esc(d.origin)} lo enviado y entra aquí lo que escribas.</p>`
                },
                {
                    id: 'receiveGrid', tipo: 'html', class: 'w-full',
                    html: `
                        <label class="block text-xs font-semibold text-gray-500 mb-1.5">Lo que llegó <span class="text-red-500">*</span></label>
                        <div class="cp-rej inv-rej">
                            <table>
                                <thead><tr>
                                    <th class="cp-rej-clave">Clave</th><th>Producto</th><th class="n">Enviado</th>
                                    <th class="n cp-rej-cant">Recibido</th><th class="n">Faltó</th>
                                </tr></thead>
                                <tbody id="receiveRows">${rows}</tbody>
                            </table>
                        </div>
                    `
                },
                { id: 'receive_note', lbl: 'Nota', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Obligatoria si llegó menos: qué pasó', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveReceive(d, values, close)
        });

        // «Faltó» se recalcula al escribir.
        $('#modalReceive').on('input', '.inv-rej-campo', (e) => {
            const input = $(e.currentTarget);
            const it    = this.items[Number(input.data('index'))];
            const got   = Number(input.val());
            const cell  = input.closest('tr').find('.inv-rec-falta');
            const miss  = it && input.val() !== '' && got >= 0 ? Math.round((it.quantity - got) * 1000) / 1000 : 0;

            cell.html(miss > 0 ? `<span class="cp-chip bg-amber-50 text-amber-700">${qtyText(miss)}</span>` : '<span class="cp-celda-sub">—</span>');
        });
    }

    saveReceive(d, values, close) {
        const lines = [];
        let short   = false;
        let error   = '';

        $('#modalReceive .inv-rej-campo').each((_, el) => {
            if (error) return;

            const input = $(el);
            const it    = this.items[Number(input.data('index'))];
            const got   = Number(input.val());

            if (input.val() === '' || !(got >= 0)) error = `Escribe cuánto llegó de «${it.name}» (0 si no llegó).`;
            else if (got > it.quantity + 0.00001) error = `De «${it.name}» se enviaron ${qtyText(it.quantity)}: no pueden llegar más.`;
            else if (!it.decimals && Math.floor(got) !== got) error = `«${it.name}» se cuenta en ${it.unit}: sin decimales.`;

            if (got + 0.00001 < it.quantity) short = true;

            lines.push({ id: it.id, received: got });
        });

        if (error) return warnBox(error);
        if (!lines.some((l) => l.received > 0)) return warnBox('No llegó nada: mejor recházalo y escribe por qué.');
        if (short && !String(values.receive_note || '').trim()) return warnBox('Llegó menos de lo enviado: escribe en la nota qué pasó.');

        return saveFrom('modalReceive', async () => {
            const r = await useFetch({
                url: this._link,
                data: { opc: 'receiveTransfer', id: d.id, receive_note: values.receive_note || '', lines: JSON.stringify(lines) }
            });

            notify(r);

            if (r && r.status == 200) {
                close();
                this.reload();
            }
        });
    }

    // -- Rechazar y cancelar (no mueven nada: solo piden el motivo) --

    reject(id, folio = '') {
        this.cancelDoc({
            opc: 'rejectTransfer', id, folio, what: 'el traspaso', key: false, verb: 'Rechazar',
            saveText: 'Rechazar traspaso', subtitle: 'No se mueve nada: regresa como rechazado', ph: '¿Por qué se rechaza?',
            done: () => this.reload()
        });
    }

    cancel(id, folio = '') {
        this.cancelDoc({
            opc: 'cancelTransfer', id, folio, what: 'el traspaso', key: false,
            saveText: 'Cancelar traspaso', subtitle: 'No se mueve nada: nadie lo había recibido', ph: '¿Por qué se cancela?',
            done: () => this.reload()
        });
    }
}
