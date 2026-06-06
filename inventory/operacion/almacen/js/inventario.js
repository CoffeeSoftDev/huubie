const SAMPLE_MOVIMIENTO = {
    tipo: 'Entrada',
    warehouse_id: '',
    note: '',
    lineas: []
};

const SAMPLE_LINEA = {
    item_id: '',
    quantity: 1,
    cost: 0,
    unit_id: null
};

class Inventario extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'inventario';
        this.lineas       = [];
    }

    render() {
        this.lineas = [];
        this.layout();
        this.filterBar();
        this.lsMovimientos();
    }

    layout() {
        this.primaryLayout({
            parent: 'container-inventario',
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: {
                    class: 'w-full mb-3',
                    id: `filterBar${this.PROJECT_NAME}`
                },
                container: {
                    class: 'w-full h-full',
                    id: `container${this.PROJECT_NAME}`
                }
            }
        });
    }

    filterBar() {
        const tiposMovimiento = [
            { id: 'Todos',   valor: 'Todos'   },
            { id: 'ENTRADA', valor: 'Entrada' },
            { id: 'MERMA',   valor: 'Salida'  }
        ];

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: 'input-calendar',
                    id: 'calendarInventario',
                    lbl: 'Rango de Fechas',
                    class: 'col-12 col-md-3'
                },
                {
                    opc: 'select',
                    id: 'tipo_movimiento',
                    lbl: 'Tipo de Movimiento',
                    class: 'col-12 col-md-2',
                    data: tiposMovimiento,
                    onchange: 'inventario.lsMovimientos()'
                },
                {
                    opc: 'button',
                    id: 'btnNuevoMovimiento',
                    text: 'Nuevo Movimiento',
                    class: 'col-12 col-md-2',
                    className: 'w-100',
                    icono: 'icon-plus',
                    color_btn: 'primary',
                    onClick: () => this.showCapturePanel()
                }
            ]
        });

        dataPicker({
            parent: 'calendarInventario',
            onSelect: () => this.lsMovimientos()
        });
    }

    lsMovimientos() {
        const picker = $('#calendarInventario').data('daterangepicker');
        const fi = picker ? picker.startDate.format('YYYY-MM-DD') : '';
        const ff = picker ? picker.endDate.format('YYYY-MM-DD') : '';

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: 'lsMovimientos',
                fi: fi,
                ff: ff,
                tipo_movimiento: $('#tipo_movimiento').val() || 'Todos'
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                title: 'Movimientos de Inventario',
                subtitle: 'Historial de entradas y salidas',
                center: [1, 2, 3, 4, 5, 6]
            }
        });
    }

    // -- Capture panel --

    showCapturePanel() {
        this.lineas = [];

        const opcionesAlmacen = (typeof almacenesInventario !== 'undefined' && almacenesInventario.length)
            ? almacenesInventario
            : (typeof almacenes !== 'undefined' ? almacenes : []);

        const defaultWarehouse = opcionesAlmacen.find(a => a.is_default == 1) || opcionesAlmacen[0] || {};

        const productosDisp = typeof productosInventario !== 'undefined' ? productosInventario : [];

        $(`#container${this.PROJECT_NAME}`).html(
            '<div id="captureHeader"></div><div id="captureBody"></div>'
        );

        this.renderCaptureHeader();
        this.renderCaptureForm(opcionesAlmacen, defaultWarehouse, productosDisp);
        this.renderLineasTable();
    }

    renderCaptureHeader() {
        $('#captureHeader').html(
            '<div id="captureActions"></div>'
        );

        this.createfilterBar({
            parent: 'captureActions',
            data: [
                {
                    opc: 'button',
                    id: 'btnGuardarCaptura',
                    text: 'Guardar Movimiento',
                    class: 'col-12 col-md-2',
                    className: 'w-100',
                    icono: 'icon-ok',
                    color_btn: 'success',
                    onClick: () => this.guardarMovimiento()
                },
                {
                    opc: 'button',
                    id: 'btnCancelarCaptura',
                    text: 'Cancelar',
                    class: 'col-12 col-md-2',
                    className: 'w-100',
                    icono: 'icon-cancel',
                    color_btn: 'danger',
                    onClick: () => this.cancelarCaptura()
                }
            ]
        });
    }

    renderCaptureForm(opcionesAlmacen, defaultWarehouse, productosDisp) {
        const tiposCaptura = [
            { id: 'Entrada', valor: 'Entrada' },
            { id: 'Salida',  valor: 'Salida'  }
        ];

        this.coffeeForm({
            parent: 'captureBody',
            id: 'formCaptura',
            class: 'flex flex-wrap items-end gap-y-2 mb-4 p-3 border rounded bg-white',
            json: [
                {
                    opc: 'select',
                    id: 'capTipo',
                    lbl: 'Tipo de Movimiento',
                    class: 'w-full sm:w-1/4 px-2',
                    data: tiposCaptura
                },
                {
                    opc: 'select',
                    id: 'capAlmacen',
                    lbl: 'Almacén',
                    class: 'w-full sm:w-1/4 px-2',
                    data: opcionesAlmacen
                },
                {
                    opc: 'input',
                    id: 'capNota',
                    lbl: 'Nota',
                    class: 'w-full sm:w-1/2 px-2',
                    required: false
                }
            ]
        });

        if (defaultWarehouse.id) {
            $('#capAlmacen').val(defaultWarehouse.id);
        }

        this.renderAgregarLinea(productosDisp);
    }

    renderAgregarLinea(productosDisp) {
        $('#captureBody').append('<div id="agregarLinea"></div><div id="tablaLineas"></div>');

        this.coffeeForm({
            parent: 'agregarLinea',
            id: 'formLinea',
            class: 'flex flex-wrap items-end gap-y-2 mb-3 p-3 border rounded bg-gray-50',
            json: [
                {
                    opc: 'select',
                    id: 'lineaProducto',
                    lbl: 'Insumo',
                    class: 'w-full sm:w-1/3 px-2',
                    data: productosDisp
                },
                {
                    opc: 'input',
                    id: 'lineaCantidad',
                    lbl: 'Cantidad',
                    tipo: 'numero',
                    class: 'w-full sm:w-1/4 px-2',
                    value: '1'
                },
                {
                    opc: 'input',
                    id: 'lineaCosto',
                    lbl: 'Costo unitario',
                    tipo: 'cifra',
                    class: 'w-full sm:w-1/4 px-2',
                    value: '0'
                },
                {
                    opc: 'button',
                    id: 'btnAgregarLinea',
                    text: 'Agregar',
                    class: 'w-full sm:w-1/6 px-2',
                    className: 'w-100',
                    icono: 'icon-plus',
                    color_btn: 'primary',
                    onClick: () => this.agregarLinea(productosDisp)
                }
            ]
        });
    }

    agregarLinea(productosDisp) {
        const itemId   = $('#lineaProducto').val();
        const cantidad = parseFloat($('#lineaCantidad').val());
        const costo    = parseFloat($('#lineaCosto').val());

        if (!itemId) {
            alert({ icon: 'warning', text: 'Selecciona un insumo', btn1: true });
            return;
        }

        if (isNaN(cantidad) || cantidad <= 0) {
            alert({ icon: 'warning', text: 'La cantidad debe ser mayor a cero', btn1: true });
            return;
        }

        if (isNaN(costo) || costo < 0) {
            alert({ icon: 'warning', text: 'El costo no puede ser negativo', btn1: true });
            return;
        }

        const producto = (productosDisp || []).find(p => String(p.id) === String(itemId));
        const unitId   = producto ? producto.unit_id : null;

        this.lineas.push({
            item_id:  itemId,
            quantity: cantidad,
            cost:     costo,
            unit_id:  unitId,
            nombre:   producto ? producto.valor : itemId
        });

        $('#lineaProducto').val('');
        $('#lineaCantidad').val('1');
        $('#lineaCosto').val('0');

        this.renderLineasTable();
    }

    renderLineasTable() {
        const rows = this.lineas.map((l, idx) => ({
            id:       idx,
            Insumo:   l.nombre,
            Cantidad: l.quantity,
            Costo:    {
                html:  '$' + parseFloat(l.cost).toFixed(2),
                class: 'text-end'
            },
            Subtotal: {
                html:  '$' + (l.quantity * l.cost).toFixed(2),
                class: 'text-end'
            },
            Acción: {
                html:  `<button class="btn btn-sm btn-danger" onclick="inventario.quitarLinea(${idx})"><i class="icon-trash"></i></button>`,
                class: 'text-center'
            }
        }));

        this.createCoffeTable({
            parent: 'tablaLineas',
            id: 'tbLineasCaptura',
            theme: 'light',
            title: 'Líneas del movimiento',
            subtitle: `${this.lineas.length} insumo(s) agregado(s)`,
            data: {
                thead: ['Insumo', 'Cantidad', 'Costo', 'Subtotal', 'Acción'],
                row:   rows
            },
            center: [1, 4],
            right:  [2, 3]
        });
    }

    quitarLinea(idx) {
        this.lineas.splice(idx, 1);
        this.renderLineasTable();
    }

    async guardarMovimiento() {
        if (!this.lineas.length) {
            alert({ icon: 'warning', text: 'Agrega al menos un insumo', btn1: true });
            return;
        }

        const tipo        = $('#capTipo').val();
        const warehouseId = $('#capAlmacen').val();
        const note        = $('#capNota').val();

        if (!warehouseId) {
            alert({ icon: 'warning', text: 'Selecciona un almacén', btn1: true });
            return;
        }

        const lineasPayload = this.lineas.map(l => ({
            item_id:  l.item_id,
            quantity: l.quantity,
            cost:     l.cost,
            unit_id:  l.unit_id
        }));

        const response = await useFetch({
            url: this._link,
            data: {
                opc:          'addMovimiento',
                tipo:         tipo,
                warehouse_id: warehouseId,
                note:         note,
                lineas:       JSON.stringify(lineasPayload)
            }
        });

        if (response.status === 200) {
            alert({
                icon:     'success',
                title:    'Movimiento registrado',
                text:     response.message + ' — Folio: ' + response.folio,
                btn1:     true,
                btn1Text: 'Aceptar'
            });
            this.render();
        } else {
            alert({
                icon:  'error',
                text:  response.message,
                btn1:  true
            });
        }
    }

    cancelarCaptura() {
        this.swalQuestion({
            opts: {
                title: '¿Cancelar captura?',
                html:  'Los datos ingresados se perderán.',
                icon:  'warning'
            },
            data: {},
            methods: {
                send: () => {
                    this.render();
                }
            }
        });
    }
}
