// -- Entradas --
// Compra, producción, devolución, inventario inicial. La producción nace
// Pendiente y suma al confirmarla (pestaña «Por confirmar»).
// Ayudantes (notify, esc, InvPage, InvGrid) en inventarios.js.

let entradas;

$(() => {
    entradas = new Inflows('ctrl/ctrl-entradas.php', 'root');
    entradas.init();
});

class Inflows extends InvPage {

    constructor(link, div_modulo) {
        super(link, div_modulo, {
            name: 'Inflows',
            title: 'Entradas',
            help: 'Lo que llega al almacén: compras, producción y devoluciones',
            tabKey: 'inventarios:entradas:tab:v1'
        });
        this.grid = null;
    }

    tabsList() {
        return [
            { id: 'list', tab: 'Entradas', icon: 'arrow-down-to-line', render: () => this.renderList(), reopen: () => this.lsList() },
            { id: 'pending', tab: 'Por confirmar', icon: 'chef-hat', render: () => this.renderPending(), reopen: () => this.lsPending() }
        ];
    }

    get canCapture() {
        return this.can('create') || this.can('producir');
    }

    // -- Lista --

    renderList() {
        $('#container-list').html(`
            <div id="filterBarInflows" class="mb-[8px]"></div>
            <div id="summaryInflows" class="inv-resumen"></div>
            <div id="containerInflows"></div>
        `);

        this.createfilterBar({
            parent: 'filterBarInflows',
            id: 'fbInflows',
            prefijo: 'ent_',
            coffeesoft: true,
            data: [
                { opc: 'input-calendar', id: 'calendar', lbl: 'Periodo', required: false, readonly: true, class: 'col-12 col-lg-3' },
                {
                    opc: 'select', id: 'origin_id', lbl: 'Tipo de entrada', required: false, class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, ...(this.data.origins || [])], onchange: 'entradas.lsList()'
                },
                {
                    opc: 'select', id: 'status', lbl: 'Estado', required: false, class: 'col-12 col-lg-2',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'applied', valor: 'Aplicadas' },
                        { id: 'pending', valor: 'Pendientes' },
                        { id: 'cancelled', valor: 'Canceladas' }
                    ],
                    onchange: 'entradas.lsList()'
                },
                ...(this.canCapture ? [{ opc: 'button', id: 'btnNewInflow', class: 'col-12 col-lg-2', text: 'Nueva entrada', onClick: () => this.add() }] : [])
            ]
        });

        this.periodPicker('ent_calendar', () => this.lsList());
        this.lsList();
    }

    // Columnas: Folio, Fecha, Tipo, Proveedor, Almacén, Productos [, Importe], Estado, Capturó
    columns() {
        return this.costs ? { right: [7], center: [2, 6, 8] } : { right: [], center: [2, 6, 7] };
    }

    lsList() {
        this.table({
            parent: 'containerInflows',
            filterBar: 'filterBarInflows',
            id: 'tbInflows',
            data: { opc: 'lsInflows', ...this.periodData('ent_calendar') },
            ...this.columns(),
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                const s = data.summary || {};

                this.csTabCount('pending', data.pending);
                this.paintSummary('summaryInflows', [
                    { html: `<b>${s.docs || 0}</b> ${s.docs === 1 ? 'entrada' : 'entradas'}` },
                    s.total !== undefined ? { html: `Importe <b>${money(s.total)}</b>` } : null
                ]);
            }
        });
    }

    // -- Por confirmar --

    renderPending() {
        $('#container-pending').html(`
            <div id="filterBarPending" class="mb-[8px]"></div>
            <div id="containerPending"></div>
        `);

        this.createfilterBar({
            parent: 'filterBarPending',
            id: 'fbPending',
            prefijo: 'pen_',
            coffeesoft: true,
            data: this.can('producir')
                ? [{ opc: 'button', id: 'btnNewProduction', class: 'col-12 col-lg-2', text: 'Registrar producción', onClick: () => this.add('PRODUCCION') }]
                : []
        });

        this.lsPending();
    }

    lsPending() {
        this.table({
            parent: 'containerPending',
            filterBar: 'filterBarPending',
            id: 'tbPending',
            data: { opc: 'lsInflows', tab: 'pending' },
            ...this.columns(),
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                this.csTabCount('pending', data.pending);
            }
        });
    }

    reload() {
        if (this.opened.list) this.lsList();
        if (this.opened.pending) this.lsPending();
    }

    // -- Captura --

    async add(code = '') {
        const o = await useFetch({ url: this._link, data: { opc: 'formOptions' } });

        if (!o || o.status != 200) return notify(o);

        const origins = o.origins || [];
        const first   = origins.find((x) => x.code === code) || origins[0];
        const third   = 'w-full sm:w-1/3';
        const half    = 'w-full sm:w-1/2';

        this.options = o;
        this.grid    = new InvGrid({
            modal: 'modalInflow',
            mode: 'in',
            products: o.products,
            costs: o.costs,
            warehouseId: () => $('#modalInflow #warehouse_id').val(),
            date: () => $('#modalInflow #operation_date').val()
        });

        const suppliers = (o.suppliers || []).map((s) => `<option value="${esc(s.valor)}"></option>`).join('');

        this.csModal({
            id: 'modalInflow',
            title: 'Nueva entrada',
            subtitle: 'Suma al almacén lo que llegó',
            lucideIcon: 'arrow-down-to-line',
            width: 'max-w-5xl',
            json: [
                { id: 'origin_id', lbl: 'Tipo de entrada', tipo: 'select', empty: false, class: third, data: origins, value: first ? first.id : '' },
                { id: 'warehouse_id', lbl: 'Almacén', tipo: 'select', empty: false, class: third, data: o.warehouses || [] },
                { id: 'operation_date', lbl: 'Fecha', tipo: 'date', class: third, value: o.today, max: o.today },
                {
                    id: 'supplierField', tipo: 'html', class: half,
                    html: `
                        <label for="invSupplier" class="block text-xs font-semibold text-gray-500 mb-1.5">Proveedor <span class="text-red-500 inv-req hidden">*</span></label>
                        <input id="invSupplier" type="text" list="invSuppliers" maxlength="160" autocomplete="off" placeholder="Elige uno o escribe uno nuevo"
                            class="w-full text-sm text-gray-800 bg-[#fff] border-[1px] border-gray-300 rounded-lg px-[12px] py-2 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15">
                        <datalist id="invSuppliers">${suppliers}</datalist>
                    `
                },
                { id: 'invoice_folio', lbl: 'Factura o nota', tipo: 'text', icon: 'receipt', maxlength: 50, ph: 'Opcional', class: half },
                { id: 'originNote', tipo: 'html', class: 'w-full', html: '<p class="inv-aviso" id="inflowOriginNote"></p>' },
                { id: 'gridField', tipo: 'html', class: 'w-full', html: this.grid.html() },
                { id: 'note', lbl: 'Nota', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Opcional', class: 'w-full' }
            ],
            onSave: (values, close) => this.save(values, close)
        });

        this.grid.bind();
        this.bindOrigin();
        $('#modalInflow #operation_date').attr('max', o.today);
    }

    origin() {
        return (this.options.origins || []).find((x) => String(x.id) === String($('#modalInflow #origin_id').val())) || {};
    }

    // Proveedor obligatorio en Compra; la Producción avisa que nace pendiente.
    bindOrigin() {
        const modal = $('#modalInflow');
        const sync  = () => {
            const o    = this.origin();
            const note = o.note || (o.pending ? 'Nace pendiente: suma al almacén cuando alguien la confirme.' : '');

            modal.find('.inv-req').toggleClass('hidden', !o.supplier);
            modal.find('#inflowOriginNote').text(note).toggleClass('hidden', !note);
            modal.find('.cs-modal-title').text(o.code === 'PRODUCCION' ? 'Registrar producción' : 'Nueva entrada');
        };

        modal.on('change', '#origin_id', sync);
        sync();
    }

    save(values, close) {
        const o        = this.origin();
        const supplier = String($('#invSupplier').val() || '').trim();
        const known    = (this.options.suppliers || []).find((s) => s.valor.toLowerCase() === supplier.toLowerCase());
        const today    = this.options.today;

        if (!values.operation_date)           return warnBox('Escribe la fecha de la entrada.');
        if (values.operation_date > today)    return warnBox('La fecha no puede ser futura.');
        if (o.supplier && !supplier)          return warnBox('Este tipo de entrada pide proveedor.');

        const grid = this.grid.lines();

        if (grid.error) return warnBox(grid.error);

        return saveFrom('modalInflow', async () => {
            const r = await useFetch({
                url: this._link,
                data: {
                    opc: 'addInflow',
                    ...values,
                    supplier_id: known ? known.id : '',
                    supplier_name: known ? '' : supplier,
                    lines: JSON.stringify(grid.lines)
                }
            });

            if (r && r.status == 200) {
                close();
                notify(r);
                this.reload();
            } else {
                notify(r);
            }
        });
    }

    // -- Detalle, confirmar y cancelar --

    async show(id) {
        const r = await useFetch({ url: this._link, data: { opc: 'getInflow', id } });

        if (!r || r.status != 200) return notify(r);

        const d      = r.data;
        const status = { pending: 'Pendiente', applied: 'Aplicada', cancelled: 'Cancelada' }[d.status] || d.status;
        const costs  = this.costs;

        // Clave, Producto, Cantidad [, Costo, Importe], Lote, Caduca [, Antes, Quedó]
        const right  = costs ? [3, 4, 5] : [3];
        const after  = costs ? 8 : 6;

        this.detail({
            id: 'modalInflowDetail',
            title: `Entrada ${d.folio}`,
            subtitle: `${d.origin || 'Sin tipo'} · ${status}`,
            icon: 'arrow-down-to-line',
            warn: d.status === 'pending' ? 'Pendiente: todavía no suma al almacén.' : (d.status === 'cancelled' ? `Cancelada: ${esc(d.cancel_reason || '')}` : ''),
            info: [
                ['Fecha', esc(d.date)],
                ['Almacén', esc(d.warehouse)],
                ['Proveedor', d.supplier ? esc(d.supplier) : ''],
                ['Factura o nota', d.invoice_folio ? esc(d.invoice_folio) : ''],
                ['Capturó', `${esc(d.user)} <small>${esc(d.created)}</small>`],
                ['Confirmó', d.confirmed ? esc(d.confirmed) : ''],
                ['Canceló', d.cancelled ? esc(d.cancelled) : ''],
                ['Unidades', qtyText(d.units)],
                ['Importe', d.total !== null ? money(d.total) : ''],
                ['Nota', d.note ? esc(d.note) : '']
            ],
            lines: r.lines || [],
            right: d.status !== 'pending' ? [...right, after, after + 1] : right,
            center: costs ? [6, 7] : [4, 5],
            save: d.can_confirm ? { text: 'Confirmar producción', onSave: (close) => { close(); this.confirm(d.id, d.folio); } } : null,
            action: d.can_cancel ? { text: 'Cancelar', lucideIcon: 'ban', onClick: () => { $('#modalInflowDetail .cs-modal-x').trigger('click'); this.cancel(d.id, d.folio); } } : null
        });
    }

    confirm(id, folio = '') {
        confirmSend({
            title: `¿Confirmar la producción ${folio}?`.replace(' ?', '?'),
            text: 'Lo producido suma al almacén. Ya no se puede editar.',
            okLabel: 'Sí, confirmar',
            data: { opc: 'confirmInflow', id },
            done: (r) => {
                notify(r);
                if (r && r.status == 200) this.reload();
            }
        });
    }

    cancel(id, folio = '') {
        this.cancelDoc({ opc: 'cancelInflow', id, folio, what: 'la entrada', done: () => this.reload() });
    }
}
