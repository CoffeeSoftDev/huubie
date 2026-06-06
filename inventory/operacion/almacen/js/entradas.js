const SAMPLE_ENTRADA = {
    note: '',
    date_inflow: '',
    inflow_origin_id: '',
    warehouse_id: '',
    supplier_id: '',
    productos: []
};

class Entradas extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'entradas';
        this.lineas       = [];
    }

    render() {
        this.lineas = [];
        this.layout();
        this.filterBar();
        this.lsEntradas();
    }

    layout() {
        this.primaryLayout({
            parent: 'container-entradas',
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full mb-3', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full h-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        $(`#filterBar${this.PROJECT_NAME}`).prepend(`
            <div class="px-2 pb-2">
                <h2 class="text-2xl font-semibold">📥 Entradas</h2>
                <p class="text-gray-400">Recepciones de mercancía al almacén</p>
            </div>
            <div id="kpis${this.PROJECT_NAME}" class="px-2 pb-3"></div>
        `);
    }

    filterBar() {
        const origenes = [{ id: '', valor: 'Todos los orígenes' }, ...(typeof origenesEntrada !== 'undefined' ? origenesEntrada : [])];

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: 'input-calendar',
                    id: 'calendarEntradas',
                    lbl: 'Rango de Fechas',
                    class: 'col-12 col-md-3'
                },
                {
                    opc: 'select',
                    id: 'origenEntradas',
                    lbl: 'Origen',
                    class: 'col-12 col-md-2',
                    data: origenes,
                    onchange: 'entradas.lsEntradas()'
                },
                {
                    opc: 'select',
                    id: 'estadoEntradas',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: [
                        { id: 'Activas',   valor: 'Activas'   },
                        { id: '',          valor: 'Todas'     },
                        { id: 'Aplicada',  valor: 'Aplicada'  },
                        { id: 'Cancelada', valor: 'Cancelada' }
                    ],
                    onchange: 'entradas.lsEntradas()'
                },
                {
                    opc: 'button',
                    id: 'btnNuevaEntrada',
                    text: 'Nueva Entrada',
                    class: 'col-12 col-md-3',
                    className: 'w-100',
                    icono: 'icon-plus',
                    color_btn: 'primary',
                    onClick: () => this.showCapturePanel()
                }
            ]
        });

        dataPicker({
            parent: 'calendarEntradas',
            onSelect: () => this.lsEntradas()
        });
    }

    getRange() {
        const picker = $('#calendarEntradas').data('daterangepicker');
        return {
            fi: picker ? picker.startDate.format('YYYY-MM-DD') : '',
            ff: picker ? picker.endDate.format('YYYY-MM-DD') : ''
        };
    }

    lsEntradas() {
        const range = this.getRange();
        this.lsKpis();

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: 'lsEntradas',
                fi: range.fi,
                ff: range.ff,
                origin_id: $('#origenEntradas').val() || '',
                status: $('#estadoEntradas').val() || ''
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [6, 7, 9],
                right: [8]
            }
        });
    }

    async lsKpis() {
        const range = this.getRange();
        const resp  = await useFetch({ url: this._link, data: { opc: 'showEntradas', fi: range.fi, ff: range.ff } });
        const c     = resp && resp.counts ? resp.counts : {};

        $(`#kpis${this.PROJECT_NAME}`).html(`
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${this.kpiCard('Entradas', parseInt(c.total_entradas || 0), 'text-blue-600')}
                ${this.kpiCard('Costo Total', '$' + Number(c.total_costo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'text-gray-800')}
                ${this.kpiCard('Unidades', Number(c.total_unidades || 0), 'text-yellow-600')}
                ${this.kpiCard('Aplicadas', parseInt(c.total_aplicadas || 0), 'text-green-600')}
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
        const origenes         = typeof origenesEntrada !== 'undefined' ? origenesEntrada : [];
        const proveedores      = [{ id: '', valor: 'Sin proveedor' }, ...(typeof proveedoresEntrada !== 'undefined' ? proveedoresEntrada : [])];

        $(`#container${this.PROJECT_NAME}`).html('<div id="captureHeaderEnt"></div><div id="captureBodyEnt"></div>');

        this.createfilterBar({
            parent: 'captureHeaderEnt',
            data: [
                {
                    opc: 'button', id: 'btnGuardarEnt', text: 'Guardar Entrada', class: 'col-12 col-md-2',
                    className: 'w-100', icono: 'icon-ok', color_btn: 'success', onClick: () => this.guardarEntrada()
                },
                {
                    opc: 'button', id: 'btnCancelarEnt', text: 'Cancelar', class: 'col-12 col-md-2',
                    className: 'w-100', icono: 'icon-cancel', color_btn: 'danger', onClick: () => this.cancelarCaptura()
                }
            ]
        });

        this.coffeeForm({
            parent: 'captureBodyEnt',
            id: 'formCapturaEnt',
            class: 'flex flex-wrap items-end gap-y-2 mb-4 p-3 border rounded bg-white',
            json: [
                { opc: 'select', id: 'entOrigen', lbl: 'Origen', class: 'w-full sm:w-1/4 px-2', data: origenes },
                { opc: 'select', id: 'entAlmacen', lbl: 'Almacén', class: 'w-full sm:w-1/4 px-2', data: opcionesAlmacen },
                { opc: 'select', id: 'entProveedor', lbl: 'Proveedor', class: 'w-full sm:w-1/4 px-2', data: proveedores },
                { opc: 'input', id: 'entNota', lbl: 'Nota', class: 'w-full sm:w-1/4 px-2', required: false }
            ]
        });

        if (defaultWarehouse.id) $('#entAlmacen').val(defaultWarehouse.id);

        $('#captureBodyEnt').append('<div id="agregarLineaEnt"></div><div id="tablaLineasEnt"></div>');

        this.coffeeForm({
            parent: 'agregarLineaEnt',
            id: 'formLineaEnt',
            class: 'flex flex-wrap items-end gap-y-2 mb-3 p-3 border rounded bg-gray-50',
            json: [
                { opc: 'select', id: 'entLineaProducto', lbl: 'Producto', class: 'w-full sm:w-1/4 px-2', data: productosDisp, onchange: 'entradas.onSelectProducto()' },
                { opc: 'input', id: 'entLineaCantidad', lbl: 'Cantidad', tipo: 'numero', class: 'w-full sm:w-1/6 px-2', value: '1' },
                { opc: 'input', id: 'entLineaCosto', lbl: 'Costo unitario', tipo: 'cifra', class: 'w-full sm:w-1/6 px-2', value: '0' },
                { opc: 'input', id: 'entLineaLote', lbl: 'Lote', class: 'w-full sm:w-1/6 px-2', required: false },
                { opc: 'input', id: 'entLineaCaducidad', lbl: 'Caducidad', type: 'date', class: 'w-full sm:w-1/6 px-2', required: false },
                {
                    opc: 'button', id: 'btnAgregarLineaEnt', text: 'Agregar', class: 'w-full sm:w-1/6 px-2',
                    className: 'w-100', icono: 'icon-plus', color_btn: 'primary', onClick: () => this.agregarLinea(productosDisp)
                }
            ]
        });

        this.renderLineasTable();
    }

    onSelectProducto() {
        const id       = $('#entLineaProducto').val();
        const productos = typeof productosInventario !== 'undefined' ? productosInventario : [];
        const producto = productos.find(p => String(p.id) === String(id));
        if (producto && producto.cost_unit != null) $('#entLineaCosto').val(producto.cost_unit);
    }

    agregarLinea(productosDisp) {
        const itemId    = $('#entLineaProducto').val();
        const cantidad  = parseFloat($('#entLineaCantidad').val());
        const costo     = parseFloat($('#entLineaCosto').val());
        const lote      = $('#entLineaLote').val();
        const caducidad = $('#entLineaCaducidad').val();

        if (!itemId) { alert({ icon: 'warning', text: 'Selecciona un producto', btn1: true }); return; }
        if (isNaN(cantidad) || cantidad <= 0) { alert({ icon: 'warning', text: 'La cantidad debe ser mayor a cero', btn1: true }); return; }
        if (isNaN(costo) || costo < 0) { alert({ icon: 'warning', text: 'El costo no puede ser negativo', btn1: true }); return; }

        const producto = (productosDisp || []).find(p => String(p.id) === String(itemId));

        this.lineas.push({
            item_id: itemId,
            quantity: cantidad,
            cost: costo,
            batch_code: lote || null,
            expires_at: caducidad || null,
            unit_id: producto ? producto.unit_id : null,
            nombre: producto ? producto.valor : itemId
        });

        $('#entLineaProducto').val('');
        $('#entLineaCantidad').val('1');
        $('#entLineaCosto').val('0');
        $('#entLineaLote').val('');
        $('#entLineaCaducidad').val('');

        this.renderLineasTable();
    }

    renderLineasTable() {
        const rows = this.lineas.map((l, idx) => ({
            id: idx,
            Producto: l.nombre,
            Cantidad: l.quantity,
            Costo: { html: '$' + parseFloat(l.cost).toFixed(2), class: 'text-end' },
            Subtotal: { html: '$' + (l.quantity * l.cost).toFixed(2), class: 'text-end' },
            Lote: l.batch_code || '-',
            Caducidad: l.expires_at || '-',
            Acción: { html: `<button class="btn btn-sm btn-danger" onclick="entradas.quitarLinea(${idx})"><i class="icon-trash"></i></button>`, class: 'text-center' }
        }));

        this.createCoffeTable({
            parent: 'tablaLineasEnt',
            id: 'tbLineasEnt',
            theme: 'light',
            title: 'Productos de la entrada',
            subtitle: `${this.lineas.length} producto(s) agregado(s)`,
            data: { thead: ['Producto', 'Cantidad', 'Costo', 'Subtotal', 'Lote', 'Caducidad', 'Acción'], row: rows },
            center: [1, 4, 5, 6],
            right: [2, 3]
        });
    }

    quitarLinea(idx) {
        this.lineas.splice(idx, 1);
        this.renderLineasTable();
    }

    async guardarEntrada() {
        if (!this.lineas.length) { alert({ icon: 'warning', text: 'Agrega al menos un producto', btn1: true }); return; }

        const originId    = $('#entOrigen').val();
        const warehouseId = $('#entAlmacen').val();
        const supplierId  = $('#entProveedor').val();
        const note        = $('#entNota').val();

        if (!originId)    { alert({ icon: 'warning', text: 'Selecciona el origen', btn1: true }); return; }
        if (!warehouseId) { alert({ icon: 'warning', text: 'Selecciona un almacén', btn1: true }); return; }

        const payload = {
            note: note,
            inflow_origin_id: originId,
            warehouse_id: warehouseId,
            supplier_id: supplierId,
            productos: this.lineas.map(l => ({
                item_id: l.item_id,
                quantity: l.quantity,
                cost: l.cost,
                batch_code: l.batch_code,
                expires_at: l.expires_at,
                unit_id: l.unit_id
            }))
        };

        const response = await useFetch({ url: this._link, data: { opc: 'saveEntrada', payload: JSON.stringify(payload) } });

        if (response.status === 200) {
            alert({ icon: 'success', title: 'Entrada registrada', text: response.message + ' — Folio: ' + response.folio, btn1: true, btn1Text: 'Aceptar' });
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

    async verEntrada(id) {
        const resp = await useFetch({ url: this._link, data: { opc: 'getEntrada', id: id } });
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
            title: 'Entrada ' + h.folio,
            width: 640,
            html: `
                <div class="text-sm text-left">
                    <div class="grid grid-cols-2 gap-1 mb-3">
                        <div><b>Origen:</b> ${h.origin_name || '-'}</div>
                        <div><b>Almacén:</b> ${h.warehouse_name || '-'}</div>
                        <div><b>Proveedor:</b> ${h.supplier_name || '-'}</div>
                        <div><b>Fecha:</b> ${h.date_inflow || '-'}</div>
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
                    <p class="text-right font-bold mt-2">Total: $${Number(h.total_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
            `,
            confirmButtonText: 'Cerrar'
        });
    }

    cancelEntrada(id) {
        this.swalQuestion({
            opts: {
                title: '¿Cancelar entrada?',
                html: 'Se revertirá el stock agregado y la entrada pasará a Cancelada.',
                icon: 'warning'
            },
            data: { opc: 'cancelEntrada', id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: 'success', text: response.message, btn1: true });
                        this.lsEntradas();
                    } else {
                        alert({ icon: 'error', text: response.message, btn1: true });
                    }
                }
            }
        });
    }
}
