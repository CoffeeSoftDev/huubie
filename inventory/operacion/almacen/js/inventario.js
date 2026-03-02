class Inventario extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "inventario";
    }

    render() {
        this.layout();
        this.filterBar();
        this.lsMovimientos();
    }

    layout() {
        this.primaryLayout({
            parent: "container-inventario",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full mb-3 border rounded p-3", id: `filterBar${this.PROJECT_NAME}` },
                container: { class: "w-full h-full", id: `container${this.PROJECT_NAME}` }
            }
        });


    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "input-calendar",
                    id: "calendar",
                    lbl: "Rango de Fechas",
                    class: "col-12 col-md-3"
                },
                {
                    opc: "select",
                    id: "tipo_movimiento",
                    lbl: "Tipo de Movimiento",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todos" },
                        ...tipoMovimiento
                    ],
                    onchange: "inventario.lsMovimientos()"
                },

                {
                    opc: "button",
                    id: "btnNuevaLista",
                    text: "Nueva Lista",
                    class: "col-12 col-md-2",
                    className:'w-100',
                    icono: "icon-plus",
                    color_btn: "primary",
                    onClick: () => this.addMovimiento()
                }
            ]
        });

        dataPicker({
            parent: "calendar",
            onSelect: () => this.lsMovimientos()
        });
    }

    lsMovimientos() {
        let rangePicker = getDataRangePicker("calendar");

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: "lsMovimientos",
                fi: rangePicker.fi,
                ff: rangePicker.ff
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: "light",
                title: "Lista de Movimientos de Inventario",
                subtitle: "Historial de entradas y salidas",
                center: [1, 2, 3, 4, 5, 6]
            }
        });
    }

    addMovimiento() {
        this.createModalForm({
            id: "formMovimientoAdd",
            data: { opc: "addMovimiento" },
            bootbox: {
                title: "Nueva Lista de Movimiento",
                size:'small',
                closeButton: true
            },
            json: this.jsonMovimiento(),
            success: (response) => {
                console.log(response)

                if (response.status === 200) {

                    captura.render(response.id_movimiento);
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    cancelMovimiento(id, event) {
        this.swalQuestion({
            opts: {
                title: "¿Cancelar Movimiento?",
                html: `¿?<br>
                       Esta acción revertirá los cambios de stock realizados.`,
                icon: "warning"
            },
            data: {
                opc: "cancelMovimiento",
                id: id
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            title: "Movimiento Cancelado",
                            text: response.message,
                            btn1: true
                        });
                        this.lsMovimientos();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonMovimiento() {
        return [
            {
                opc: "input",
                id: "date",
                lbl: "Fecha del Movimiento",
                type: "date",
                class: "col-12 mb-3",
                value: moment().format('YYYY-MM-DD')
            },
            {
                opc: "select",
                id: "movement_type_id",
                lbl: "Tipo de Movimiento",
                class: "col-12 mb-3",
                data: tipoMovimiento,
                text: "valor",
                value: "id"
            },

        ];
    }
}

class CapturaMovimiento extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "capturaInventario";
        this.idMovimiento = null;
    }

    async render(idMovimiento) {
        this.idMovimiento = idMovimiento;

        const movimiento = await useFetch({
            url: this._link,
            data: { opc: "getMovimiento", id: idMovimiento }
        });

        if (movimiento.status === 200) {
            this.movimientoData = movimiento.data;
            this.layout();
            this.lsDetalleMovimiento();
        }
    }

    layout() {
        const container = $("<div>", {
            id: this.PROJECT_NAME,
            class: "w-full p-4"
        });

        const header = $("<div>", {
            class: "mb-4 pb-4 border flex justify-between items-center rounded-lg p-4"
        }).html(`
            <div class="flex items-center gap-3">
                <span class="text-2xl">📦</span>
                <div>
                    <h2 class="text-xl font-semibold text-gray-800">Captura de inventarios</h2>
                    <p class="text-gray-500 text-sm">Folio: ${this.movimientoData.folio} | Tipo: ${this.movimientoData.tipo_movimiento}</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button id="btnGuardarMovimiento" class="px-6 py-2 bg-green-500 w-32 hover:bg-green-600 text-white text-sm rounded-lg font-medium transition">
                    Guardar lista
                </button>
                <button id="btnCancelarCaptura" class="px-6 py-2 bg-red-400 w-32 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition">
                    Salir
                </button>
            </div>
        `);

        const mainContent = $("<div>", {
            class: "grid grid-cols-12 gap-4 mb-4"
        });

        const leftSection = $("<div>", {
            class: "col-span-3"
        }).html(`
            <div class="border rounded-lg p-4 h-full">
                <div id="resumenMovimiento"></div>
            </div>
        `);

        const rightSection = $("<div>", {
            class: "col-span-9"
        }).html(`
            <div class="border rounded-lg p-4">
                <div id="seccionAgregarProducto"></div>
                <div id="tablaProductos"></div>
            </div>
        `);

        mainContent.append(leftSection, rightSection);

        container.append(header, mainContent);
        $("#container-inventario").html(container);

        $("#btnGuardarMovimiento").on("click", () => this.guardarMovimiento());
        $("#btnCancelarCaptura").on("click", () => this.cancelarCaptura());

        this.filterAddProduct();
        this.updateResumen();
    }

    filterAddProduct() {
        this.createfilterBar({
            parent: "seccionAgregarProducto",
            data: [
                {
                    opc: "select",
                    id: "selectProducto",
                    lbl: "Producto",
                    class: "col-12 col-md-3",
                    data: productos,
                    placeholder: "Seleccionar producto",
                },
                {
                    opc: "input",
                    id: "inputCantidad",
                    lbl: "Cantidad",
                    tipo: "numero",
                    class: "col-12 col-md-3",
                    value: "1",
                    min: "1"
                },
                {
                    opc: "button",
                    id: "btnAgregarProducto",
                    text: "Agregar",
                    className: 'w-100',
                    class: "col-12 col-md-3",
                    icono: "icon-plus",
                    onClick: () => this.addProducto()
                }
            ]
        });

        $("#selectProducto").option_select({ select2: true,
             placeholder: 'Selecciona uno o más módulos',
              multiple: true });

    }

    async addProducto() {
        const idProducto = $("#selectProducto").val();
        const cantidad = parseInt($("#inputCantidad").val());

        if (!idProducto) {
            alert({
                icon: "warning",
                text: "Selecciona un producto",
                btn1: true
            });
            return;
        }

        if (cantidad <= 0) {
            alert({
                icon: "warning",
                text: "La cantidad debe ser mayor a cero",
                btn1: true
            });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: {
                opc: "addProductoMovimiento",
                id_movimiento: this.idMovimiento,
                product_id: idProducto,
                quantity: cantidad
            }
        });

        if (response.status === 200) {
            $("#selectProducto").val(null).trigger("change");
            $("#inputCantidad").val(1);

            this.lsDetalleMovimiento();
            this.updateResumen();
        } else {
            alert({
                icon: "error",
                text: response.message,
                btn1: true
            });
        }
    }

    lsDetalleMovimiento() {
        this.createTable({
            parent: "tablaProductos",
            idFilterBar: `filterBar`,

            data: {
                opc: "lsDetalleMovimiento",
                id_movimiento: this.idMovimiento
            },
            coffeesoft: true,
            conf: { datatable: true },
            attr: {
                id: "tbDetalleMovimiento",
                theme: "light",
                striped:true,
                center: [ 1, 3, 4,5]
            },
            success: () => {
                this.updateResumen();
            }
        });
    }

    async deleteProducto(idDetalle) {
        const response = await useFetch({
            url: this._link,
            data: {
                opc: "deleteProductoMovimiento",
                id: idDetalle
            }
        });

        if (response.status === 200) {
            this.lsDetalleMovimiento();
            this.updateResumen();
        } else {
            alert({
                icon: "error",
                text: response.message,
                btn1: true
            });
        }
    }

    async updateResumen() {
        const detalles = await useFetch({
            url: this._link,
            data: {
                opc: "lsDetalleMovimiento",
                id_movimiento: this.idMovimiento
            }
        });


        const totalProductos = detalles.ls ? detalles.ls.length : 0;
        const totalUnidades = detalles.ls ? detalles.ls.reduce((sum, item) => sum + parseInt(item.cantidad), 0) : 0;

        const tipoColor = this.movimientoData.tipo_movimiento === 'Entrada'
            ? 'text-green-600'
            : 'text-red-600';

        const tipoIcon = this.movimientoData.tipo_movimiento === 'Entrada'
            ? '↑'
            : '↓';

        const resumen = $("<div>", {
            class: "sticky top-4"
        }).html(`
            <h3 class="font-semibold text-gray-700 mb-3 pb-2 border-b">Resumen</h3>

            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600 text-sm">Folio:</span>
                    <span class="font-bold text-gray-900">${this.movimientoData.folio}</span>
                </div>

                <div class="flex justify-between items-center">
                    <span class="text-gray-600 text-sm">Tipo:</span>
                    <span class="font-semibold ${tipoColor}">${tipoIcon} ${this.movimientoData.tipo_movimiento}</span>
                </div>
            </div>

            <hr class="my-3 border-gray-200">

            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600 text-sm">Productos:</span>
                    <span class="font-bold text-lg text-gray-900">${totalProductos}</span>
                </div>

                <div class="flex justify-between items-center">
                    <span class="text-gray-600 text-sm">Total unidades:</span>
                    <span class="font-bold text-lg text-gray-900">${totalUnidades}</span>
                </div>
            </div>
        `);

        $("#resumenMovimiento").html(resumen);
    }

    async guardarMovimiento() {
        const response = await useFetch({
            url: this._link,
            data: {
                opc: "guardarMovimiento",
                id_movimiento: this.idMovimiento
            }
        });

        if (response.status === 200) {
            alert({
                icon: "success",
                title: "Lista Guardada",
                text: response.message,
                btn1: true,
                btn1Text: "Aceptar"
            });

            inventario.render();
        } else {
            alert({
                icon: "error",
                text: response.message,
                btn1: true
            });
        }
    }

    cancelarCaptura() {
        Swal.fire({
            title: "¿Cancelar Captura?",
            text: "¿Deseas regresar sin guardar los cambios?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Sí, Cancelar",
            cancelButtonText: "No, Continuar"
        }).then((result) => {
            if (result.isConfirmed) {
                inventario.render();
            }
        });
    }

    async editMovimiento(idMovimiento) {
        this.idMovimiento = idMovimiento;

        const movimiento = await useFetch({
            url: this._link,
            data: { opc: "getMovimiento", id: idMovimiento }
        });

        if (movimiento.status === 200) {
            this.movimientoData = movimiento.data;
            this.layout();
            this.lsDetalleMovimiento();
        } else {
            alert({
                icon: "error",
                text: movimiento.message || "No se pudo cargar el movimiento",
                btn1: true
            });
        }
    }
}
