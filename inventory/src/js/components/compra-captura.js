// Captura de lo surtido en una compra: se copia lo anotado en la hoja impresa
// (cantidad, costo total y dónde se compró) y se agregan compras de más. Al
// confirmar entrega el payload a onCapture; el ctrl genera la entrada al almacén.
class CompraCaptura {

    constructor(options) {
        const defaults = {
            parent: 'body',
            id:     'compraCapturaModal',
            json:   { id: null, folio: '', nombre: '', fecha: '', branch_id: '', warehouse_id: '', surte: '', productos: [] },
            data:   { almacenes: [], proveedores: [], productos: [], compradores: [] },
            labels: {
                title:      'Capturar surtido',
                aviso:      'Copia lo anotado en la hoja. Si algo no se consiguió, déjalo en 0. Al confirmar se genera una entrada al almacén con lo surtido.',
                surtio:     'Surtió',
                fecha:      'Fecha de surtido',
                almacen:    'Almacén destino',
                proveedor:  'Proveedor (opcional)',
                provPh:     '-- Sin proveedor --',
                producto:   'Producto',
                pedido:     'Pedido',
                surtido:    'Surtido',
                costo:      'Costo total',
                lugar:      'Dónde se compró',
                extraPh:    'Agregar algo que se compró de más...',
                extra:      'extra',
                nota:       'Nota (opcional)',
                notaPh:     'Faltantes, cambios de precio, etc.',
                completo:   'Completo',
                parcial:    'Parcial',
                noSurtido:  'No surtido',
                total:      'Total gastado',
                cancelar:   'Cancelar',
                confirmar:  'Confirmar y dar entrada',
                almacenReq: 'Elige el almacén al que entra lo surtido',
                nadaReq:    'No se surtió nada. Si ya no se va a comprar, cancela la compra',
                costoReq:   'Falta el costo de',
                fechaReq:   'La fecha de surtido no puede ser posterior a hoy'
            },
            onCapture: () => {}
        };

        const o = options || {};
        this.opts        = Object.assign({}, defaults, o);
        this.opts.json   = Object.assign({}, defaults.json, o.json || {});
        this.opts.data   = Object.assign({}, defaults.data, o.data || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        this.cls = {
            label: 'block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1',
            input: 'w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            cell:  'no-spin w-full px-2 py-1.5 text-sm font-bold text-center text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15',
            th:    'px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold'
        };

        this.lineas = this.opts.json.productos.map(p => ({
            detail_id: p.detailId,
            product_id: p.product_id,
            nombre:   p.nombre,
            sku:      p.sku,
            unidad:   p.unidad,
            pedido:   Number(p.quantity_ordered || 0),
            estimado: Number(p.quantity_ordered || 0) * Number(p.cost || 0),
            quantity: Number(p.quantity_ordered || 0),
            total:    '',
            place:    ''
        }));
    }

    // -- Render --

    render() {
        const o = this.opts;
        const l = o.labels;
        const c = o.json;

        $(`#${o.id}`).remove();
        this.wrap = $('<div>', { id: o.id, class: 'fixed inset-0 z-[100] flex items-center justify-center' });

        const panel = $('<div>', { class: 'relative z-10 w-full max-w-[1000px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col' });
        panel.append(this.buildHeader(), this.buildConfig(), this.buildTable(), this.buildResumen(), this.buildFooter());

        this.wrap.append($('<div>', { class: 'absolute inset-0 bg-black/40', 'data-cc-backdrop': '' }), panel);
        $(o.parent === 'body' || !$(`#${o.parent}`).length ? 'body' : `#${o.parent}`).append(this.wrap);

        this.renderLineas();
        this.bindEvents();
        if (window.lucide) lucide.createIcons();
        setTimeout(() => this.wrap.find('[data-field="quantity"]').first().trigger('focus').trigger('select'), 60);
    }

    buildHeader() {
        const c = this.opts.json;
        return $('<div>', { class: 'flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0' }).append(
            $('<div>', { class: 'flex items-center gap-3' }).append(
                $('<div>', { class: 'w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20' }).append(
                    $('<i>', { 'data-lucide': 'clipboard-check', class: 'w-5 h-5 text-white' })
                ),
                $('<div>').append(
                    $('<h3>', { class: 'text-sm font-bold text-gray-800', text: this.opts.labels.title }),
                    $('<p>', { class: 'text-[11px] text-gray-500' }).append(
                        $('<span>', { class: 'font-semibold text-gray-700', text: c.folio }),
                        document.createTextNode(` · ${c.nombre} · ${c.fechaLabel || c.fecha}`)
                    )
                )
            ),
            $('<button>', { type: 'button', class: 'w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700', 'data-cc-close': '' }).append(
                $('<i>', { 'data-lucide': 'x', class: 'w-4 h-4' })
            )
        );
    }

    buildConfig() {
        const o   = this.opts;
        const l   = o.labels;
        const c   = o.json;
        const cls = this.cls;

        const almacenes = (o.data.almacenes || []).filter(a => !c.branch_id || String(a.branch_id) === String(c.branch_id));
        const selAlmacen = $('<select>', { id: `${o.id}_almacen`, class: cls.input + ' cursor-pointer' })
            .append($('<option>', { value: '', text: '-- Elige almacén --' }))
            .append(almacenes.map(a => $('<option>', { value: a.id, text: a.valor, selected: String(a.id) === String(c.warehouse_id) })));

        const selProveedor = $('<select>', { id: `${o.id}_proveedor`, class: cls.input + ' cursor-pointer' })
            .append($('<option>', { value: '', text: l.provPh }))
            .append((o.data.proveedores || []).map(p => $('<option>', { value: p.id, text: p.valor })));

        const field = (label, input) => $('<div>').append($('<label>', { class: cls.label, text: label }), input);

        return $('<div>', { class: 'px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0' }).append(
            $('<div>', { class: 'flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3 border-l-4 border-blue-600 bg-blue-600/5' }).append(
                $('<i>', { 'data-lucide': 'info', class: 'w-4 h-4 mt-0.5 flex-shrink-0 text-blue-700' }),
                $('<p>', { class: 'text-[11px] text-gray-600 leading-relaxed', text: l.aviso })
            ),
            $('<div>', { class: 'grid grid-cols-1 md:grid-cols-4 gap-3' }).append(
                field(l.surtio, $('<input>', { id: `${o.id}_surte`, type: 'text', maxlength: 100, list: `${o.id}_compradores`, value: c.surte, class: cls.input })),
                $('<datalist>', { id: `${o.id}_compradores` }).append((o.data.compradores || []).map(x => $('<option>', { value: x.valor }))),
                field(l.fecha, $('<input>', { id: `${o.id}_fecha`, type: 'date', value: this.hoy(), max: this.hoy(), class: cls.input })),
                field(l.almacen, selAlmacen),
                field(l.proveedor, selProveedor)
            )
        );
    }

    buildTable() {
        const o   = this.opts;
        const l   = o.labels;
        const cls = this.cls;

        const extra = $('<div>', { class: 'relative px-3 py-2 border-t border-gray-100' }).append(
            $('<div>', { class: 'flex items-center gap-2' }).append(
                $('<i>', { 'data-lucide': 'plus-circle', class: 'w-4 h-4 text-blue-600' }),
                $('<input>', { id: `${o.id}_extra`, type: 'text', autocomplete: 'off', placeholder: l.extraPh, class: 'flex-1 text-xs outline-none py-1 placeholder:text-blue-700 placeholder:font-semibold' })
            ),
            $('<div>', { id: `${o.id}_sugerencias`, class: 'hidden absolute z-20 left-3 right-3 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-56 overflow-y-auto' })
        );

        return $('<div>', { class: 'flex-1 min-h-0 overflow-y-auto cs-scroll' }).append(
            $('<table>', { class: 'w-full border-collapse' }).append(
                $('<thead>', { class: 'sticky top-0 z-10 bg-gray-50 border-b border-gray-200' }).append(
                    $('<tr>').append(
                        $('<th>', { class: cls.th + ' text-left', text: l.producto }),
                        $('<th>', { class: cls.th + ' text-center w-24', text: l.pedido }),
                        $('<th>', { class: cls.th + ' text-center w-28', text: l.surtido }),
                        $('<th>', { class: cls.th + ' text-center w-36', text: l.costo }),
                        $('<th>', { class: cls.th + ' text-left w-52', text: l.lugar }),
                        $('<th>', { class: cls.th + ' w-10' })
                    )
                ),
                $('<tbody>', { id: `${o.id}_tbody`, class: 'divide-y divide-gray-100' })
            ),
            extra,
            $('<div>', { class: 'px-5 py-3' }).append(
                $('<label>', { class: cls.label, text: l.nota }),
                $('<textarea>', { id: `${o.id}_nota`, rows: 2, placeholder: l.notaPh, class: cls.input + ' resize-none' })
            )
        );
    }

    buildResumen() {
        return $('<div>', { id: `${this.opts.id}_resumen`, class: 'flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex flex-wrap items-center justify-end gap-5 text-[11px] text-gray-500' });
    }

    buildFooter() {
        const l = this.opts.labels;
        return $('<div>', { class: 'flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0' }).append(
            $('<button>', { type: 'button', class: 'px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100', text: l.cancelar, 'data-cc-close': '' }),
            $('<button>', { type: 'button', id: `${this.opts.id}_confirmar`, class: 'px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5' }).append(
                $('<i>', { 'data-lucide': 'package-check', class: 'w-3.5 h-3.5' }),
                $('<span>', { text: l.confirmar })
            )
        );
    }

    renderLineas() {
        const o   = this.opts;
        const cls = this.cls;

        $(`#${o.id}_tbody`).empty().append(this.lineas.map((linea, idx) => {
            const estado = this.estadoLinea(linea);
            return $('<tr>', { class: estado.row, 'data-idx': idx }).append(
                $('<td>', { class: 'px-3 py-2' }).append(
                    $('<div>', { class: 'flex items-center gap-2' }).append(
                        $('<i>', { 'data-lucide': estado.icon, class: `w-4 h-4 flex-shrink-0 ${estado.color}`, 'data-estado': '' }),
                        $('<div>', { class: 'min-w-0' }).append(
                            $('<p>', { class: 'text-xs font-semibold text-gray-800 truncate', text: linea.nombre }),
                            $('<p>', { class: 'text-[10px] text-gray-400', text: [linea.sku, linea.detail_id ? '' : o.labels.extra].filter(Boolean).join(' · ') })
                        )
                    )
                ),
                $('<td>', { class: 'px-3 py-2 text-center text-xs text-gray-600', text: linea.detail_id ? `${this.fmtQty(linea.pedido)} ${linea.unidad || ''}` : '—' }),
                $('<td>', { class: 'px-3 py-1.5' }).append(
                    $('<input>', { type: 'number', min: 0, step: '0.01', value: linea.quantity, class: cls.cell, 'data-field': 'quantity', 'data-idx': idx })
                ),
                $('<td>', { class: 'px-3 py-1.5' }).append(
                    $('<input>', {
                        type: 'number', min: 0, step: '0.01', value: linea.total, class: cls.cell, 'data-field': 'total', 'data-idx': idx,
                        placeholder: linea.estimado ? '~' + this.fmtMoney(linea.estimado) : '0.00'
                    })
                ),
                $('<td>', { class: 'px-3 py-1.5' }).append(
                    $('<input>', { type: 'text', maxlength: 100, value: linea.place, class: this.cls.input + ' !py-1.5', 'data-field': 'place', 'data-idx': idx })
                ),
                $('<td>', { class: 'px-2 py-1.5 text-center' }).append(linea.detail_id ? '' :
                    $('<button>', { type: 'button', class: 'w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50', 'data-remove': idx }).append(
                        $('<i>', { 'data-lucide': 'x', class: 'w-3 h-3' })
                    )
                )
            );
        }));

        this.renderResumen();
        if (window.lucide) lucide.createIcons();
    }

    renderResumen() {
        const l        = this.opts.labels;
        const pedidas  = this.lineas.filter(x => x.detail_id);
        const completo = pedidas.filter(x => Number(x.quantity) >= x.pedido && x.pedido > 0).length;
        const parcial  = pedidas.filter(x => Number(x.quantity) > 0 && Number(x.quantity) < x.pedido).length;
        const nada     = pedidas.filter(x => !(Number(x.quantity) > 0)).length;
        const total    = this.lineas.reduce((s, x) => s + (Number(x.total) || 0), 0);

        const dato = (texto, valor, color) => $('<span>', { class: 'flex items-center gap-1.5' }).append(
            document.createTextNode(texto + ': '), $('<strong>', { class: `text-sm ${color}`, text: valor })
        );

        $(`#${this.opts.id}_resumen`).empty().append(
            dato(l.completo, completo, 'text-green-600'),
            dato(l.parcial, parcial, 'text-orange-500'),
            dato(l.noSurtido, nada, 'text-red-500'),
            $('<span>', { class: 'h-5 w-px bg-gray-300' }),
            dato(l.total, this.fmtMoney(total), 'text-gray-800')
        );
    }

    estadoLinea(linea) {
        const qty = Number(linea.quantity) || 0;
        if (!linea.detail_id)       return { icon: 'plus-circle',    color: 'text-blue-600',   row: 'bg-blue-50/40' };
        if (qty >= linea.pedido)    return { icon: 'check-circle-2', color: 'text-green-600',  row: '' };
        if (qty > 0)                return { icon: 'circle-dashed',  color: 'text-orange-400', row: 'bg-orange-500/5' };
        return { icon: 'x-circle', color: 'text-red-400', row: 'bg-red-500/5' };
    }

    // -- Extras --

    sugerir(term) {
        const o    = this.opts;
        const box  = $(`#${o.id}_sugerencias`);
        const q    = String(term || '').trim().toLowerCase();
        const res  = q ? (o.data.productos || []).filter(p => `${p.nombre} ${p.sku}`.toLowerCase().includes(q)).slice(0, 8) : [];

        if (!res.length) { box.addClass('hidden').empty(); return; }
        box.empty().removeClass('hidden').append(res.map(p =>
            $('<div>', { class: 'px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between gap-2', 'data-add': p.id }).append(
                $('<span>', { text: p.nombre }), $('<span>', { class: 'text-gray-400 font-mono', text: p.sku })
            )
        ));
    }

    addExtra(productId) {
        const p = (this.opts.data.productos || []).find(x => String(x.id) === String(productId));
        if (!p) return;
        this.lineas.push({ detail_id: 0, product_id: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, pedido: 0, estimado: 0, quantity: 1, total: '', place: '' });
        $(`#${this.opts.id}_extra`).val('');
        $(`#${this.opts.id}_sugerencias`).addClass('hidden').empty();
        this.renderLineas();
        this.wrap.find(`tr[data-idx="${this.lineas.length - 1}"] [data-field="total"]`).trigger('focus');
    }

    // -- Eventos --

    bindEvents() {
        const o = this.opts;

        this.wrap.on('click', '[data-cc-close], [data-cc-backdrop]', () => this.close());
        this.wrap.on('input', 'input[data-field]', (e) => {
            const input = $(e.currentTarget);
            const linea = this.lineas[Number(input.attr('data-idx'))];
            linea[input.attr('data-field')] = input.val();
            if (input.attr('data-field') === 'quantity') {
                const estado = this.estadoLinea(linea);
                const row    = input.closest('tr');
                row.attr('class', estado.row);
                row.find('[data-estado]').replaceWith($('<i>', { 'data-lucide': estado.icon, class: `w-4 h-4 flex-shrink-0 ${estado.color}`, 'data-estado': '' }));
                if (window.lucide) lucide.createIcons();
            }
            this.renderResumen();
        });
        this.wrap.on('click', '[data-remove]', (e) => {
            this.lineas.splice(Number($(e.currentTarget).attr('data-remove')), 1);
            this.renderLineas();
        });
        this.wrap.on('input', `#${o.id}_extra`, (e) => this.sugerir(e.target.value));
        this.wrap.on('mousedown', '[data-add]', (e) => {
            e.preventDefault();
            this.addExtra($(e.currentTarget).attr('data-add'));
        });
        this.wrap.on('click', `#${o.id}_confirmar`, () => this.confirmar());

        $(document).off('keydown.compraCaptura').on('keydown.compraCaptura', (e) => {
            if (e.key === 'Escape' && !$('[data-ab-backdrop]').length) this.close();
        });
    }

    // -- Confirmar --

    confirmar() {
        const o     = this.opts;
        const l     = o.labels;
        const fecha = $(`#${o.id}_fecha`).val() || this.hoy();

        if (!$(`#${o.id}_almacen`).val()) { this.notify(l.almacenReq); return; }
        if (fecha > this.hoy())            { this.notify(l.fechaReq); return; }

        const surtidas = this.lineas.filter(x => Number(x.quantity) > 0);
        if (!surtidas.length) { this.notify(l.nadaReq); return; }

        const sinCosto = surtidas.find(x => !(Number(x.total) > 0));
        if (sinCosto) {
            this.notify(`${l.costoReq} ${sinCosto.nombre}`);
            this.wrap.find(`tr[data-idx="${this.lineas.indexOf(sinCosto)}"] [data-field="total"]`).trigger('focus');
            return;
        }

        const linea = (x) => ({ quantity: Number(x.quantity) || 0, total: Number(x.total) || 0, place: x.place || '' });

        o.onCapture({
            id:           o.json.id,
            warehouse_id: $(`#${o.id}_almacen`).val(),
            supplier_id:  $(`#${o.id}_proveedor`).val() || 0,
            date:         fecha,
            buyer_name:   $.trim($(`#${o.id}_surte`).val()),
            note:         $.trim($(`#${o.id}_nota`).val()),
            items:        this.lineas.filter(x => x.detail_id).map(x => Object.assign({ detail_id: x.detail_id }, linea(x))),
            extras:       this.lineas.filter(x => !x.detail_id).map(x => Object.assign({ product_id: x.product_id }, linea(x)))
        }, () => this.close());
    }

    close() {
        $(document).off('keydown.compraCaptura');
        if (this.wrap) this.wrap.remove();
    }

    // -- Helpers --

    notify(title) {
        if (this.tpl && typeof this.tpl.alertBox === 'function') this.tpl.alertBox({ type: 'warning', title });
        else alert(title);
    }

    hoy() {
        return moment().format('YYYY-MM-DD');
    }

    fmtQty(n) {
        return Number(Number(n || 0).toFixed(2));
    }

    fmtMoney(n) {
        return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}


Templates.prototype.compraCaptura = function (options) {
    const captura = new CompraCaptura(options);
    // Referencia al Templates para reutilizar componentes propios (alertBox).
    captura.tpl = this;
    captura.render();
    return captura;
};
