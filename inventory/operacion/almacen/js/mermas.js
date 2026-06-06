const SAMPLE_MERMA = {
    note: '',
    date_shrinkage: '',
    shrinkage_reason_id: '',
    warehouse_id: '',
    productos: []
};

class Mermas extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'mermas';
        this.lineas       = [];
    }

    render() {
        this.lineas = [];
        this.layout();
        this.filterBar();
        this.lsMermas();
    }

    layout() {
        this.primaryLayout({
            parent: 'container-mermas',
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full mb-3', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full h-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        $(`#filterBar${this.PROJECT_NAME}`).prepend(`
            <div class="px-2 pb-2">
                <h2 class="text-2xl font-semibold">📉 Mermas</h2>
                <p class="text-gray-400">Salidas por pérdida, caducidad o consumo</p>
            </div>
            <div id="kpis${this.PROJECT_NAME}" class="px-2 pb-3"></div>
        `);
    }

    filterBar() {
        const motivos = [{ id: '', valor: 'Todos los motivos' }, ...(typeof motivosMerma !== 'undefined' ? motivosMerma : [])];

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: 'input-calendar',
                    id: 'calendarMermas',
                    lbl: 'Rango de Fechas',
                    class: 'col-12 col-md-3'
                },
                {
                    opc: 'select',
                    id: 'motivoMermas',
                    lbl: 'Motivo',
                    class: 'col-12 col-md-2',
                    data: motivos,
                    onchange: 'mermas.lsMermas()'
                },
                {
                    opc: 'select',
                    id: 'estadoMermas',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: [
                        { id: 'Activas',   valor: 'Activas'   },
                        { id: '',          valor: 'Todas'     },
                        { id: 'Aplicada',  valor: 'Aplicada'  },
                        { id: 'Cancelada', valor: 'Cancelada' }
                    ],
                    onchange: 'mermas.lsMermas()'
                },
                {
                    opc: 'button',
                    id: 'btnNuevaMerma',
                    text: 'Nueva Merma',
                    class: 'col-12 col-md-3',
                    className: 'w-100',
                    icono: 'icon-plus',
                    color_btn: 'primary',
                    onClick: () => this.showCapturePanel()
                }
            ]
        });

        dataPicker({
            parent: 'calendarMermas',
            onSelect: () => this.lsMermas()
        });
    }

    getRange() {
        const picker = $('#calendarMermas').data('daterangepicker');
        return {
            fi: picker ? picker.startDate.format('YYYY-MM-DD') : '',
            ff: picker ? picker.endDate.format('YYYY-MM-DD') : ''
        };
    }

    lsMermas() {
        const range = this.getRange();
        this.lsKpis();

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: 'lsMermas',
                fi: range.fi,
                ff: range.ff,
                reason_id: $('#motivoMermas').val() || '',
                status: $('#estadoMermas').val() || ''
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [5, 6, 8],
                right: [7]
            }
        });
    }

    async lsKpis() {
        const range = this.getRange();
        const resp  = await useFetch({ url: this._link, data: { opc: 'showMermas', fi: range.fi, ff: range.ff } });
        const c     = resp && resp.counts ? resp.counts : {};

        $(`#kpis${this.PROJECT_NAME}`).html(`
            <div class="grid grid-cols-3 gap-3">
                ${this.kpiCard('Mermas', parseInt(c.total_mermas || 0), 'text-gray-800')}
                ${this.kpiCard('Pérdida Total', '$' + Number(c.total_costo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'text-red-600')}
                ${this.kpiCard('Unidades', Number(c.total_unidades || 0), 'text-yellow-600')}
            </div>
        `);
    }

    kpiCard(label, value, color) {
        return `
            <div class="bg-white border rounded-lg px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide font-bold text-gray-400">${label}</p>
                <p class="text-lg font-bold ${color}">${value}</p>
            </div>
        `;
    }

    showCapturePanel() {
        this.lineas = [];

        const opcionesAlmacen = (typeof almacenesInventario !== 'undefined' && almacenesInventario.length)
            ? almacenesInventario
            : (typeof almacenes !== 'undefined' ? almacenes : []);
        const defaultWarehouse = opcionesAlmacen.find(a => a.is_default == 1) || opcionesAlmacen[0] || {};
        const productosDisp    = typeof productosInventario !== 'undefined' ? productosInventario : [];
        const motivos          = typeof motivosMerma !== 'undefined' ? motivosMerma : [];

        $(`#container${this.PROJECT_NAME}`).html('<div id="captureHeaderMer"></div><div id="captureBodyMer"></div>');

        this.createfilterBar({
            parent: 'captureHeaderMer',
            data: [
                {
                    opc: 'button', id: 'btnGuardarMer', text: 'Guardar Merma', class: 'col-12 col-md-2',
                    className: 'w-100', icono: 'icon-ok', color_btn: 'success', onClick: () => this.guardarMerma()
                },
                {
                    opc: 'button', id: 'btnCancelarMer', text: 'Cancelar', class: 'col-12 col-md-2',
                    className: 'w-100', icono: 'icon-cancel', color_btn: 'danger', onClick: () => this.cancelarCaptura()
                }
            ]
        });

        this.coffeeForm({
            parent: 'captureBodyMer',
            id: 'formCapturaMer',
            class: 'flex flex-wrap items-end gap-y-2 mb-4 p-3 border rounded bg-white',
            json: [
                { opc: 'select', id: 'merMotivo', lbl: 'Motivo', class: 'w-full sm:w-1/3 px-2', data: motivos },
                { opc: 'select', id: 'merAlmacen', lbl: 'Almacén', class: 'w-full sm:w-1/3 px-2', data: opcionesAlmacen },
                { opc: 'input', id: 'merNota', lbl: 'Nota', class: 'w-full sm:w-1/3 px-2', required: false }
            ]
        });

        if (defaultWarehouse.id) $('#merAlmacen').val(defaultWarehouse.id);

        $('#captureBodyMer').append('<div id="agregarLineaMer"></div><div id="tablaLineasMer"></div>');

        this.coffeeForm({
            parent: 'agregarLineaMer',
            id: 'formLineaMer',
            class: 'flex flex-wrap items-end gap-y-2 mb-3 p-3 border rounded bg-gray-50',
            json: [
                { opc: 'select', id: 'merLineaProducto', lbl: 'Producto', class: 'w-full sm:w-1/3 px-2', data: productosDisp, onchange: 'mermas.onSelectProducto()' },
                { opc: 'input', id: 'merLineaCantidad', lbl: 'Cantidad', tipo: 'numero', class: 'w-full sm:w-1/4 px-2', value: '1' },
                { opc: 'input', id: 'merLineaCosto', lbl: 'Costo unitario', tipo: 'cifra', class: 'w-full sm:w-1/4 px-2', value: '0' },
                {
                    opc: 'button', id: 'btnAgregarLineaMer', text: 'Agregar', class: 'w-full sm:w-1/6 px-2',
                    className: 'w-100', icono: 'icon-plus', color_btn: 'primary', onClick: () => this.agregarLinea(productosDisp)
                }
            ]
        });

        this.renderLineasTable();
    }

    onSelectProducto() {
        const id        = $('#merLineaProducto').val();
        const productos = typeof productosInventario !== 'undefined' ? productosInventario : [];
        const producto  = productos.find(p => String(p.id) === String(id));
        if (producto && producto.cost_unit != null) $('#merLineaCosto').val(producto.cost_unit);
    }

    agregarLinea(productosDisp) {
        const itemId   = $('#merLineaProducto').val();
        const cantidad = parseFloat($('#merLineaCantidad').val());
        const costo    = parseFloat($('#merLineaCosto').val());

        if (!itemId) { alert({ icon: 'warning', text: 'Selecciona un producto', btn1: true }); return; }
        if (isNaN(cantidad) || cantidad <= 0) { alert({ icon: 'warning', text: 'La cantidad debe ser mayor a cero', btn1: true }); return; }
        if (isNaN(costo) || costo < 0) { alert({ icon: 'warning', text: 'El costo no puede ser negativo', btn1: true }); return; }

        const producto = (productosDisp || []).find(p => String(p.id) === String(itemId));

        this.lineas.push({
            item_id: itemId,
            quantity: cantidad,
            cost: costo,
            nombre: producto ? producto.valor : itemId
        });

        $('#merLineaProducto').val('');
        $('#merLineaCantidad').val('1');
        $('#merLineaCosto').val('0');

        this.renderLineasTable();
    }

    renderLineasTable() {
        const rows = this.lineas.map((l, idx) => ({
            id: idx,
            Producto: l.nombre,
            Cantidad: l.quantity,
            Costo: { html: '$' + parseFloat(l.cost).toFixed(2), class: 'text-end' },
            Subtotal: { html: '$' + (l.quantity * l.cost).toFixed(2), class: 'text-end' },
            Acción: { html: `<button class="btn btn-sm btn-danger" onclick="mermas.quitarLinea(${idx})"><i class="icon-trash"></i></button>`, class: 'text-center' }
        }));

        this.createCoffeTable({
            parent: 'tablaLineasMer',
            id: 'tbLineasMer',
            theme: 'light',
            title: 'Productos de la merma',
            subtitle: `${this.lineas.length} producto(s) agregado(s)`,
            data: { thead: ['Producto', 'Cantidad', 'Costo', 'Subtotal', 'Acción'], row: rows },
            center: [1, 4],
            right: [2, 3]
        });
    }

    quitarLinea(idx) {
        this.lineas.splice(idx, 1);
        this.renderLineasTable();
    }

    async guardarMerma() {
        if (!this.lineas.length) { alert({ icon: 'warning', text: 'Agrega al menos un producto', btn1: true }); return; }

        const reasonId    = $('#merMotivo').val();
        const warehouseId = $('#merAlmacen').val();
        const note        = $('#merNota').val();

        if (!reasonId)    { alert({ icon: 'warning', text: 'Selecciona el motivo', btn1: true }); return; }
        if (!warehouseId) { alert({ icon: 'warning', text: 'Selecciona un almacén', btn1: true }); return; }

        const payload = {
            note: note,
            shrinkage_reason_id: reasonId,
            warehouse_id: warehouseId,
            productos: this.lineas.map(l => ({
                item_id: l.item_id,
                quantity: l.quantity,
                cost: l.cost
            }))
        };

        const response = await useFetch({ url: this._link, data: { opc: 'saveMerma', payload: JSON.stringify(payload) } });

        if (response.status === 200) {
            alert({ icon: 'success', title: 'Merma registrada', text: response.message + ' — Folio: ' + response.folio, btn1: true, btn1Text: 'Aceptar' });
            this.render();
        } else {
            alert({ icon: 'error', text: response.message, btn1: true });
        }
    }

    cancelarCaptura() {
        this.swalQuestion({
            opts: { title: '¿Cancelar captura?', html: 'Los datos ingresados se perderán.', icon: 'warning' },
            data: {},
            methods: { send: () => this.render() }
        });
    }

    async verMerma(id) {
        const resp = await useFetch({ url: this._link, data: { opc: 'getMerma', id: id } });
        if (resp.status !== 200) { alert({ icon: 'error', text: resp.message, btn1: true }); return; }

        const h = resp.header;
        const filas = (resp.detail || []).map(d => `
            <tr class="border-b">
                <td class="py-1 text-left">${d.item_name}${d.sku ? ' <span class="text-gray-400 text-xs">' + d.sku + '</span>' : ''}</td>
                <td class="py-1 text-center">${d.quantity}</td>
                <td class="py-1 text-right">$${parseFloat(d.cost).toFixed(2)}</td>
                <td class="py-1 text-right">$${parseFloat(d.subtotal).toFixed(2)}</td>
            </tr>
        `).join('');

        Swal.fire({
            title: 'Merma ' + h.folio,
            width: 640,
            html: `
                <div class="text-sm text-left">
                    <div class="grid grid-cols-2 gap-1 mb-3">
                        <div><b>Motivo:</b> ${h.reason_name || '-'}</div>
                        <div><b>Almacén:</b> ${h.warehouse_name || '-'}</div>
                        <div><b>Fecha:</b> ${h.date_shrinkage || '-'}</div>
                        <div><b>Estado:</b> ${h.status}</div>
                        <div><b>Registró:</b> ${h.user_name || '-'}</div>
                    </div>
                    ${h.note ? '<p class="mb-2"><b>Nota:</b> ' + h.note + '</p>' : ''}
                    <table class="w-full text-sm border-t">
                        <thead><tr class="border-b font-semibold">
                            <th class="py-1 text-left">Producto</th><th class="text-center">Cant</th><th class="text-right">Costo</th><th class="text-right">Subtotal</th>
                        </tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                    <p class="text-right font-bold mt-2 text-red-600">Pérdida: $${Number(h.total_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
            `,
            confirmButtonText: 'Cerrar'
        });
    }

    cancelMerma(id) {
        this.swalQuestion({
            opts: {
                title: '¿Cancelar merma?',
                html: 'Se restaurará el stock descontado y la merma pasará a Cancelada.',
                icon: 'warning'
            },
            data: { opc: 'cancelMerma', id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: 'success', text: response.message, btn1: true });
                        this.lsMermas();
                    } else {
                        alert({ icon: 'error', text: response.message, btn1: true });
                    }
                }
            }
        });
    }
}
