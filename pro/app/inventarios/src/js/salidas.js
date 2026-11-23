// -- Salidas --
// Consumo, degustación, pedido complementario y mermas (caducidad, dañado,
// error de producción, faltante). Restan al guardarse; no se saca más de lo que hay.
// Ayudantes (notify, esc, InvPage, InvGrid, compressPhoto) en inventarios.js.

let salidas;

$(() => {
    salidas = new Outflows('ctrl/ctrl-salidas.php', 'root');
    salidas.init();
});

class Outflows extends InvPage {

    constructor(link, div_modulo) {
        super(link, div_modulo, {
            name: 'Outflows',
            title: 'Salidas',
            help: 'Lo que sale del almacén: consumo de producción y mermas',
            tabKey: 'inventarios:salidas:tab:v1'
        });
        this.grid  = null;
        this.photo = '';
    }

    tabsList() {
        return [
            { id: 'list', tab: 'Salidas', icon: 'arrow-up-from-line', render: () => this.renderTab('list'), reopen: () => this.ls('list') },
            { id: 'loss', tab: 'Mermas', icon: 'trash-2', render: () => this.renderTab('loss'), reopen: () => this.ls('loss') }
        ];
    }

    // Las dos pestañas son la misma lista: Mermas solo trae los motivos de pérdida.
    renderTab(tab) {
        const key = tab === 'loss' ? 'Loss' : 'Outflows';

        $(`#container-${tab}`).html(`
            <div id="filterBar${key}" class="mb-[8px]"></div>
            <div id="summary${key}" class="inv-resumen"></div>
            <div id="container${key}"></div>
        `);

        const prefix = tab === 'loss' ? 'mer_' : 'sal_';

        this.createfilterBar({
            parent: `filterBar${key}`,
            id: `fb${key}`,
            prefijo: prefix,
            coffeesoft: true,
            data: [
                { opc: 'input-calendar', id: 'calendar', lbl: 'Periodo', required: false, readonly: true, class: 'col-12 col-lg-3' },
                ...(tab === 'list' ? [{
                    opc: 'select', id: 'reason_id', lbl: 'Motivo', required: false, class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, ...(this.data.reasons || [])], onchange: 'salidas.ls(\'list\')'
                }] : []),
                ...(this.can('create') ? [{
                    opc: 'button', id: `btnNew${key}`, class: 'col-12 col-lg-2',
                    text: tab === 'loss' ? 'Registrar merma' : 'Nueva salida',
                    onClick: () => this.add(tab === 'loss' ? 'MERMA' : '')
                }] : [])
            ]
        });

        this.periodPicker(`${prefix}calendar`, () => this.ls(tab));
        this.ls(tab);
    }

    // Columnas: Folio, Fecha, Motivo, Departamento, Almacén, Productos [, Importe], Estado, Capturó
    ls(tab) {
        const key    = tab === 'loss' ? 'Loss' : 'Outflows';
        const prefix = tab === 'loss' ? 'mer_' : 'sal_';

        this.table({
            parent: `container${key}`,
            filterBar: `filterBar${key}`,
            id: `tb${key}`,
            data: { opc: 'lsOutflows', tab, ...this.periodData(`${prefix}calendar`) },
            ...(this.costs ? { right: [7], center: [2, 6, 8] } : { right: [], center: [2, 6, 7] }),
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                const s = data.summary || {};

                this.csTabCount('loss', data.loss);
                this.paintSummary(`summary${key}`, [
                    { html: `<b>${s.docs || 0}</b> ${tab === 'loss' ? (s.docs === 1 ? 'merma' : 'mermas') : (s.docs === 1 ? 'salida' : 'salidas')}` },
                    s.total !== undefined ? { html: `Importe <b>${money(s.total)}</b>`, tone: tab === 'loss' && s.total > 0 ? 'red' : '' } : null
                ]);
            }
        });
    }

    reload() {
        if (this.opened.list) this.ls('list');
        if (this.opened.loss) this.ls('loss');
    }

    // -- Captura --

    async add(code = '') {
        const o = await useFetch({ url: this._link, data: { opc: 'formOptions' } });

        if (!o || o.status != 200) return notify(o);

        const reasons = o.reasons || [];
        const first   = reasons.find((x) => x.code === code) || reasons[0];
        const third   = 'w-full sm:w-1/3';

        this.options = o;
        this.photo   = '';
        this.grid    = new InvGrid({
            modal: 'modalOutflow',
            mode: 'out',
            products: o.products,
            costs: o.costs,
            warehouseId: () => $('#modalOutflow #warehouse_id').val(),
            date: () => $('#modalOutflow #operation_date').val()
        });

        this.csModal({
            id: 'modalOutflow',
            title: 'Nueva salida',
            subtitle: 'Resta del almacén lo que se usó o se perdió',
            lucideIcon: 'arrow-up-from-line',
            width: 'max-w-5xl',
            json: [
                { id: 'reason_id', lbl: 'Motivo', tipo: 'select', empty: false, class: third, data: reasons, value: first ? first.id : '' },
                { id: 'warehouse_id', lbl: 'Almacén', tipo: 'select', empty: false, class: third, data: o.warehouses || [] },
                { id: 'operation_date', lbl: 'Fecha', tipo: 'date', class: third, value: o.today },
                { id: 'department_id', lbl: 'Departamento', tipo: 'select', empty: 'Sin departamento', class: third, data: o.departments || [] },
                {
                    id: 'photoField', tipo: 'html', class: 'w-full sm:w-2/3',
                    html: `
                        <label class="block text-xs font-semibold text-gray-500 mb-1.5">Foto de evidencia <span class="text-red-500 inv-req-foto hidden">*</span></label>
                        <div class="inv-foto">
                            <button type="button" class="inv-foto-btn"><i data-lucide="camera" class="w-4 h-4"></i> <span>Subir foto</span></button>
                            <img class="inv-foto-mini hidden" alt="Evidencia">
                            <button type="button" class="cp-foto-quitar hidden">Quitar</button>
                            <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden">
                        </div>
                    `
                },
                { id: 'reasonNote', tipo: 'html', class: 'w-full', html: '<p class="inv-aviso" id="outflowReasonNote"></p>' },
                { id: 'gridField', tipo: 'html', class: 'w-full', html: this.grid.html() },
                { id: 'note', lbl: 'Nota', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Opcional', class: 'w-full' }
            ],
            onSave: (values, close) => this.save(values, close)
        });

        $('#modalOutflow #operation_date').attr('max', o.today);
        this.grid.bind();
        this.bindReason();
        this.bindPhoto();

        $('#modalOutflow').on('change', '#warehouse_id', () => this.grid.refresh());
    }

    reason() {
        return (this.options.reasons || []).find((x) => String(x.id) === String($('#modalOutflow #reason_id').val())) || {};
    }

    // La merma pide foto; el consumo pide el departamento.
    bindReason() {
        const modal = $('#modalOutflow');
        const sync  = () => {
            const r    = this.reason();
            const note = [r.note, r.loss ? 'Cuenta como merma.' : ''].filter(Boolean).join(' ');

            modal.find('.inv-req-foto').toggleClass('hidden', !r.evidence);
            modal.find('label[for="department_id"]').html(`Departamento${r.department ? ' <span class="text-red-500">*</span>' : ''}`);
            modal.find('#outflowReasonNote').text(note).toggleClass('hidden', !note);
            modal.find('.cs-modal-title').text(r.loss ? 'Registrar merma' : 'Nueva salida');
        };

        modal.on('change', '#reason_id', sync);
        sync();
    }

    bindPhoto() {
        const field = $('#modalOutflow #photoField');
        const file  = field.find('input[type=file]');
        const paint = () => {
            field.find('.inv-foto-mini').attr('src', this.photo || '').toggleClass('hidden', !this.photo);
            field.find('.cp-foto-quitar').toggleClass('hidden', !this.photo);
            field.find('.inv-foto-btn span').text(this.photo ? 'Cambiar foto' : 'Subir foto');
        };

        field.on('click', '.inv-foto-btn, .inv-foto-mini', () => file.trigger('click'));
        field.on('click', '.cp-foto-quitar', () => { this.photo = ''; paint(); });

        file.on('change', async () => {
            const picked = file[0].files[0];

            file.val('');

            if (!picked) return;

            const dataUrl = await compressPhoto(picked);

            if (!dataUrl) return warnBox('No se pudo leer la foto. Usa una imagen JPG, PNG o WEBP.');

            this.photo = dataUrl;
            paint();
        });

        paint();
    }

    save(values, close) {
        const r     = this.reason();
        const today = this.options.today;

        if (!values.operation_date)        return warnBox('Escribe la fecha de la salida.');
        if (values.operation_date > today) return warnBox('La fecha no puede ser futura.');
        if (r.department && !values.department_id) return warnBox(`«${r.valor}» pide el departamento que lo consume.`);
        if (r.evidence && !this.photo)     return warnBox(`«${r.valor}» pide una foto de evidencia.`);

        const grid = this.grid.lines();

        if (grid.error) return warnBox(grid.error);

        const short = this.grid.draft.find((d) => {
            const p = this.grid.products.find((x) => x.id === d.id) || {};
            return d.quantity > this.grid.have(p) + 0.00001;
        });

        if (short) return warnBox(`No hay suficiente «${short.name}» en el almacén.`);

        return saveFrom('modalOutflow', async () => {
            const res = await useFetch({
                url: this._link,
                data: { opc: 'addOutflow', ...values, photo_b64: this.photo, lines: JSON.stringify(grid.lines) }
            });

            if (res && res.status == 200) {
                close();
                notify(res);
                this.reload();
            } else {
                notify(res);
            }
        });
    }

    // -- Detalle y cancelar --

    async show(id) {
        const r = await useFetch({ url: this._link, data: { opc: 'getOutflow', id } });

        if (!r || r.status != 200) return notify(r);

        const d     = r.data;
        const costs = this.costs;

        // Clave, Producto, Cantidad, Lote [, Costo, Importe], Antes, Quedó
        this.detail({
            id: 'modalOutflowDetail',
            title: `${d.is_loss ? 'Merma' : 'Salida'} ${d.folio}`,
            subtitle: `${d.reason || 'Sin motivo'} · ${d.status === 'cancelled' ? 'Cancelada' : 'Aplicada'}`,
            icon: d.is_loss ? 'trash-2' : 'arrow-up-from-line',
            warn: d.status === 'cancelled' ? `Cancelada: ${esc(d.cancel_reason || '')}` : '',
            info: [
                ['Fecha', esc(d.date)],
                ['Almacén', esc(d.warehouse)],
                ['Departamento', d.department ? esc(d.department) : ''],
                ['Capturó', `${esc(d.user)} <small>${esc(d.created)}</small>`],
                ['Canceló', d.cancelled ? esc(d.cancelled) : ''],
                ['Importe', d.total !== null ? money(d.total) : ''],
                ['Nota', d.note ? esc(d.note) : ''],
                ['Evidencia', d.evidence ? `<a href="${esc(d.evidence)}" target="_blank" rel="noopener"><img src="${esc(d.evidence)}" alt="Evidencia" class="inv-foto-mini"></a>` : '']
            ],
            lines: r.lines || [],
            right: costs ? [3, 5, 6, 7, 8] : [3, 5, 6],
            center: [4],
            action: d.can_cancel ? { text: 'Cancelar', lucideIcon: 'ban', onClick: () => { $('#modalOutflowDetail .cs-modal-x').trigger('click'); this.cancel(d.id, d.folio); } } : null
        });
    }

    cancel(id, folio = '') {
        this.cancelDoc({ opc: 'cancelOutflow', id, folio, what: 'la salida', done: () => this.reload() });
    }
}
