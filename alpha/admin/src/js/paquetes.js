let app;
const api = "/alpha/admin/ctrl/ctrl-paquetes.php";

$(() => {
    app = new Paquetes(api, "root");
    app.render();
});

class Paquetes extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Paquetes";
        this.dataProducto = [];
    }

    render() {
        this.layout();
    }

    layout() {
        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
            class: 'd-flex mx-2 my-2 h-100 mt-5 p-2',
            card: {
                filterBar: { class: 'w-full my-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-3 bg-[#1F2A37] rounded-lg p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.layoutTabs();
    }

    layoutTabs() {
        $("#container" + this.PROJECT_NAME).simple_json_tab({
            class: "pb-4 px-4 bg-[#1F2A37]",
            id: "tabsPaquetes",
            data: [
                { tab: "Paquetes", id: "tab-paquetes", active: true },
                { tab: "Productos", id: "tab-productos" },
                { tab: "Clasificaciones", id: "tab-clasificaciones" }
            ]
        });

        $("#container" + this.PROJECT_NAME).prepend(`
            <div class="px-4 pt-3 pb-3">
                <h2 class="text-2xl font-semibold text-white">📘 Catálogos</h2>
                <p class="text-gray-400">Administra los paquetes y productos de tu sistema.</p>
            </div>
        `);

        this.filterBarPaquetes();
        this.filterBarProductos();
        this.filterBarClasificaciones();
    }

    // INFORMACION DE PAQUETES
    filterBarPaquetes() {
        const container = $("#tab-paquetes");
        container.html('<div id="filterbar-paquetes" class="mb-2"></div><div id="tabla-paquetes"></div>');

        this.createfilterBar({
            parent: "filterbar-paquetes",
            data: [
                {
                    opc: "select",
                    id: "estado-paquetes",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    'onchange': () => this.lsPaquetes()
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    id: "btnNuevoPaquete",
                    text: "Nuevo Paquete",
                    onClick: () => this.addPaquete(),
                },
            ],
        });

       
        setTimeout(() => this.lsPaquetes(), 50);
    }

    lsPaquetes() {
        this.createTable({
            parent: "tabla-paquetes",
            idFilterBar: "filterbar-paquetes",
            data: { opc: "listPaquetes" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbPaquetes",
                theme: 'dark',
                right:[3],
                center: [4]
            },
        });
    }

    async addPaquete() {
        // Obtener datos de productos
        let dataProduct = await useFetch({ url: this._link, data: { opc: 'listProductos', estado_productos: 1 } });
        this.dataProducto = dataProduct;

        // Crear el formulario HTML
        let formHtml = `
            <h2 class="text-lg font-semibold leading-none tracking-tight text-white">Crear Nuevo Paquete</h2>
            <p class="text-sm text-muted-foreground">Completa la información del paquete.</p>
            <form id="formPaquete" class="row mt-4">
           
            <div class="form-group mb-3 col-7">
                <label for="name">Nombre del Paquete</label>
                <input type="text" class="form-control bg-[#1F2A37]" id="name" name="name" required>
            </div>
            <div class="form-group mb-3 col-5">
                <label for="price_person">Precio por Persona</label>
                <input type="text" class="form-control bg-[#1F2A37] text-end" id="price_person" name="price_person" required onkeyup="validationInputForNumber('#price_person')">
            </div>
            <div class="form-group mb-4 col-12">
                <label for="description">Descripción</label>
                <textarea class="form-control bg-[#1F2A37]" id="description" name="description"></textarea>
            </div>
            <!-- Sección de productos -->
            <div class="form-group mb-3 col-12">
                <label class='text-lg font-medium text-white'>Productos Incluidos</label>
                <p class="text-sm text-muted-foreground">Añade los productos que incluye este paquete</p>
                <div class="row mb-3 mt-3">
                    <div class='col-6'>
                        <select class="product-name form-control bg-[#1F2A37] col-12">
                            ${dataProduct.ls.map(product => `<option value="${product.id}">${product.valor}</option>`).join('')}
                        </select>
                    </div>
                    <div class='col-3 m-0'>
                        <input type="text" class="form-control bg-[#1F2A37]" id="product-quantity" placeholder="0" value="1" onkeyup="validationInputForNumber('#product-quantity')">
                    </div>
                    <div class='col-3'>
                        <div class="input-group-append">
                            <button class="btn btn-primary col-12" type="button" id="add-product" onclick='app.addProductToList()'>Añadir</button>
                        </div>
                    </div>
                </div>
                <div id="product-list" class='overflow-y-auto max-h-52'></div>
            </div>
            </form>
        `;

        // Crear el modal con Bootbox
        bootbox.dialog({
            message: formHtml,
            size: '',
            buttons: {
                cancel: {
                    label: 'Cancelar',
                    className: 'btn-secondary'
                },
                confirm: {
                    label: 'Guardar',
                    className: 'btn-primary',
                    callback: function () {
                        const form = document.getElementById('formPaquete');
                        const formData = new FormData(form);
                        const data = Object.fromEntries(formData.entries());

                        if (!data.name || !data.price_person) {
                            alert({ icon: "error", title: "Campos requeridos", text: "Por favor, completa todos los campos obligatorios." });
                            return false;
                        }

                        // Extraer productos
                        const products = [];
                        document.querySelectorAll('#product-list .product-item').forEach(item => {
                            const id = item.getAttribute('data-id');
                            const qty = item.querySelector(`#quantity-${id}`).value.trim();
                            if (id && qty > 0) {
                                products.push({ id, quantity: qty });
                            }
                        });


                        if (products.length == 0) {
                            alert({ icon: "error", title: "Productos requeridos", text: "Debes agregar al menos un producto." });
                            return false;
                        }

                        // Enviar al servidor
                        useFetch({
                            url: this._link,
                            data: {
                                opc: 'addPaquete',
                                name: data.name,
                                description: data.description || '',
                                price_person: data.price_person,
                                products: JSON.stringify(products),
                            },
                            success: (response) => {
                                if (response.status == 200) {
                                    alert({ icon: "success", text: response.message });
                                    this.lsPaquetes();
                                } else {
                                    alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                                }
                            }
                        });

                        return true;
                    }.bind(this)
                }
            }
        });
    }

    async editPaquete(id) {
        // Obtener datos
        let dataProduct = await useFetch({ url: this._link, data: { opc: 'listProductos', estado_productos: 1 } });
        let dataPackage = await useFetch({ url: this._link, data: { opc: 'getPaquete', id } });
        this.dataProducto = dataProduct;

        if (dataPackage.status !== 200) {
            alert({ icon: "error", title: "Oops!...", text: dataPackage.message });
            return;
        }

        $('#product-list').empty();
        let pkg = dataPackage.data;

        // Crear el formulario HTML
        let formHtml = `
            <h2 class="text-lg font-semibold leading-none tracking-tight text-white">Editar Paquete</h2>
            <form id="formPaquete" class="row mt-4">
                <div class="form-group mb-3 col-7">
                    <label>Nombre del Paquete</label>
                    <input type="text" class="form-control bg-[#1F2A37]" id="name" name="name" value="${pkg.name}" required>
                </div>
                <div class="form-group mb-3 col-5">
                    <label>Precio por Persona</label>
                    <input type="text" class="form-control bg-[#1F2A37] text-end" id="price_person" name="price_person" value="${pkg.price_person}" required onkeyup="validationInputForNumber('#price_person')">
                </div>
                <div class="form-group mb-4 col-12">
                    <label>Descripción</label>
                    <textarea class="form-control bg-[#1F2A37]" id="description" name="description">${pkg.description || ''}</textarea>
                </div>
                <div class="form-group mb-3 col-12">
                    <label class='text-lg font-medium text-white'>Productos Incluidos</label>
                    <p class="text-sm text-muted-foreground">Actualiza los productos del paquete</p>
                    <div class="row mb-3 mt-3">
                        <div class='col-6'>
                            <select class="product-name form-control bg-[#1F2A37] col-12">
                                ${dataProduct.ls.map(product => `<option value="${product.id}">${product.valor}</option>`).join('')}
                            </select>
                        </div>
                        <div class='col-3'>
                            <input type="text" class="form-control bg-[#1F2A37]" id="product-quantity" placeholder="0" value="1" onkeyup="validationInputForNumber('#product-quantity')">
                        </div>
                        <div class='col-3'>
                            <button class="btn btn-primary col-12" type="button" id="add-product" onclick='app.addProductToList()'>Añadir</button>
                        </div>
                    </div>
                    <div id="product-list" class='overflow-y-auto max-h-52'></div>
                </div>
            </form>
        `;

        // Crear el modal con Bootbox
        bootbox.dialog({
            message: formHtml,
            size: '',
            buttons: {
                cancel: {
                    label: 'Cancelar',
                    className: 'btn-secondary'
                },
                confirm: {
                    label: 'Guardar',
                    className: 'btn-primary',
                    callback: function () {
                        const form = document.getElementById('formPaquete');
                        const formData = new FormData(form);
                        const data = Object.fromEntries(formData.entries());

                        if (!data.name || !data.price_person) {
                            alert({ icon: "error", title: "Campos requeridos", text: "Por favor, completa los campos obligatorios." });
                            return false;
                        }

                        const products = [];
                        document.querySelectorAll('#product-list .product-item').forEach(item => {
                            const id = item.getAttribute('data-id');
                            const qty = item.querySelector(`#quantity-${id}`).value.trim();
                            if (id && qty > 0) {
                                products.push({ id, quantity: qty });
                            }
                        });


                        if (products.length == 0) {
                            alert({ icon: "error", title: "Productos requeridos", text: "Debes agregar al menos un producto." });
                            return false;
                        }

                        useFetch({
                            url: this._link,
                            data: {
                                opc: 'editPaquete',
                                name: data.name,
                                description: data.description || '',
                                price_person: data.price_person,
                                products: JSON.stringify(products),
                                id,
                            },
                            success: (response) => {
                                if (response.status == 200) {
                                    alert({ icon: "success", text: response.message });
                                    this.lsPaquetes();
                                } else {
                                    alert({ icon: "error", text: response.message });
                                }
                            }
                        });

                        return true;
                    }.bind(this)
                }
            }
        });

        // Agregar productos existentes
        pkg.products?.forEach(product => {
            $('#product-list').append(`
            <div class="product-item" data-id="${product.id}">
                <div class="border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-4 mb-2">
                    <div class="text-sm font-semibold text-white flex-1 truncate">${product.valor}</div>
                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-800 font-medium">Cantidad:</label>
                        <input type="text" class="form-control bg-[#1F2A37] w-20 text-sm" id="quantity-${product.id}" value="${product.quantity}" onkeyup="validationInputForNumber('#quantity-${product.id}')" />
                    </div>
                    <button type="button" class="btn btn-outline-danger btn-sm" id='remove-product-${product.id}' onclick="app.deleteProductToList('#remove-product-${product.id}')">
                        <i class="icon-trash"></i>
                    </button>
                </div>
            </div>
        `);
        });
    }

    addProductToList() {
        let selectProductId = $('.product-name').val();
        let quantityInput = $('#product-quantity').val().trim();
        let nameProduct = this.dataProducto.ls.find(product => product.id == selectProductId)?.valor || '';

        // Validaciones
        if (!selectProductId || isNaN(selectProductId)) {
            alert({ icon: "error", title: "Error", text: "Por favor, selecciona un producto válido." });
            return;
        }
        if (!quantityInput || isNaN(quantityInput) || quantityInput <= 0) {
            alert({ icon: "error", title: "Error", text: "Por favor, ingresa una cantidad válida." });
            return;
        }

        let existing = $(`#product-list .product-item[data-id="${selectProductId}"]`);
        if (existing.length > 0) {
            // Ya existe, sumamos cantidades
            let input = existing.find('input');
            let currentQty = parseFloat(input.val()) || 0;
            input.val(currentQty + parseFloat(quantityInput));
        } else {
            // Nuevo producto añadido
            let productItem = $(`
                    <div class="product-item" data-id="${selectProductId}">
                        <div class="border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-4 mb-2">
                            <div class="text-sm font-semibold text-gray-900 flex-1 truncate text-white">${nameProduct}</div>
                            <div class="flex items-center gap-2">
                                <label class="text-sm text-gray-800 font-medium">Cantidad:</label>
                                <input type="text" class="form-control bg-[#1F2A37] w-20 text-sm" id="quantity-${selectProductId}" value="${quantityInput}" onkeyup="validationInputForNumber('#quantity-${selectProductId}')"/>
                            </div>
                            <button type="button" class="btn btn-outline-danger btn-sm" id='remove-product-${selectProductId}' onclick="app.deleteProductToList('#remove-product-${selectProductId}')">
                                <i class="icon-trash"></i>
                            </button>
                        </div>
                    </div>
                `);
            $('#product-list').append(productItem);

            // Limpiar inputs
            $('#product-quantity').val('1');
        }
    }

    deleteProductToList(value) {
        $(value).closest('.product-item').remove();
    }

    statusPaquete(id, status) {
        const tr = $(event.target).closest("tr");
        const nombre = tr.find("td").eq(0).text();

        // Si está activo, cambiar a inactivo y viceversa
        const nuevoEstado = status == 1 ? '0' : 1;
        const mensaje = status == 1 ? '<span class="font-bold text-lg">desactivar</span>' : '<span class="font-bold text-lg">reactivar</span>';

        bootbox.confirm({
            title: 'Confirmar cambio de estado.',
            message: `¿Deseas ${mensaje} el paquete ${nombre}?`,
            buttons: {
                cancel: { label: 'Cancelar', className: 'btn-secondary' },
                confirm: { label: 'Confirmar', className: 'btn-danger' }
            },
            callback: (result) => {
                if (result) {
                    useFetch({
                        url: this._link,
                        data: {
                            opc: 'statusPaquete',
                            active: nuevoEstado,
                            id: id
                        },
                    }).then(response => {
                        if (response.status == 200) {
                            alert({ icon: 'success', text: response.message });
                            this.lsPaquetes();
                        } else {
                            alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                        }
                    });
                }
            }
        });
    }

    // 📦 Mostrar información del paquete
    async showPaquete(id) {
        const dataPackage = await useFetch({
            url: this._link,
            data: { opc: 'getPaquete', id }
        });

        if (dataPackage.status !== 200) {
            alert({ icon: "error", title: "Oops!...", text: dataPackage.message, btn1: true, btn1Text: "Ok" });
            return;
        }

        const pkg = dataPackage.data;
        let productListHtml = '';
        if (!pkg.products || pkg.products.length === 0) {
            productListHtml = '<p class="text-sm text-gray-400">No hay productos incluidos en este paquete.</p>';
        } else {
            productListHtml = pkg.products.map(product => `
                <div class="product-item" data-id="${product.id}">
                    <div class="border border-gray-200 rounded-lg p-2 px-3 shadow-sm flex items-center justify-between gap-4 mb-2">
                        <div class="flex-1 truncate">
                            <span class="text-sm font-semibold text-white block">${product.valor}</span>
                            <span class="text-sm text-gray-400 block">${product.classification}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-400">Cantidad:</label>
                            <span class="text-sm text-gray-400 font-medium">${product.quantity}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }


        bootbox.dialog({
            title: `<strong>Información del Paquete</strong>`,
            closeButton: false,
            message: `
            <div class="px-4">
                <h2 class="text-lg font-bold text-white">${pkg.name} -  $${Number(pkg.price_person).toFixed(2)}/persona</h2>
                <p class="text-sm text-muted-foreground mb-2">${pkg.description || 'No hay descripción disponible.'}</p>
               
                <h3 class="text-md font-semibold text-white mt-4 mb-2">📦 Productos Incluidos:</h3>
                <div id="product-list" class="overflow-y-auto max-h-80">
                    ${productListHtml}
                </div>
            </div>
        `,
            size: '',
            buttons: {
                ok: {
                    label: 'Cerrar',
                    className: 'btn-secondary',
                }
            }
        });
    }



    // INFORMACION DE PRODUCTOS
    filterBarProductos() {
        const container = $("#tab-productos");
        container.html('<div id="filterbar-productos" class="mb-2"></div><div id="tabla-productos"></div>');

        this.createfilterBar({
            parent: "filterbar-productos",
            data: [
                {
                    opc: "select",
                    id: "estado_productos",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    'onchange': () => this.lsProductos()
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    id: "btnNuevoProducto",
                    text: "Nuevo Producto",
                    onClick: () => this.addProducto(),
                },
            ],
        });

        $('#estado_productos').on('change', () => this.lsProductos());

        setTimeout(() => this.lsProductos(), 50);
    }

    lsProductos() {
        this.createTable({
            parent: "tabla-productos",
            idFilterBar: "filterbar-productos",
            data: { opc: "listProductos" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbProductos",
                theme: 'dark',
                right: [2],
                center: [3,4]
            },
        });
    }

    async addProducto() {
        let dataClass = await useFetch({ url: this._link, data: { opc: 'listClasificaciones', estado_clasificaciones: 1 } });
        const clasificacion = dataClass.ls.map(i => ({ id: i.id, valor: i.classification }));

        this.createModalForm({
            id: 'formModalProducto',
            data: { opc: 'addProducto' },
            bootbox: {
                title: '<strong>Nuevo Producto</strong>',
                size: ''
            },
            json: [
                { opc: 'input', lbl: 'Nombre del Producto', id: 'name', class: 'col-12 mb-3', tipo: 'texto', required: true },
                { opc: 'input', lbl: 'Precio', id: 'price', class: 'col-12 mb-3', tipo: 'cifra', required: true },
                {
                    opc: 'select',
                    id: 'id_classification',
                    lbl: 'Clasificación',
                    data: clasificacion,
                    class: 'col-12',
                    required: true
                },
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsProductos();
                } else {
                    alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });

        // Initialized
        $("#price").on('keyup', function () {
            let value = $(this).val();
            // Eliminar caracteres no numéricos ni punto
            value = value.replace(/[^0-9.]/g, '');
            // Permitir solo un punto decimal
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            $(this).val(value);
        });

    }

    async editProducto(id) {
        let dataProduct = await useFetch({ url: this._link, data: { opc: 'getProducto', id } });
        let dataClass = await useFetch({ url: this._link, data: { opc: 'listClasificaciones', estado_clasificaciones: 1 } });
        const clasificacion = dataClass.ls.map(i => ({ id: i.id, valor: i.classification }));

        if (dataProduct.status == 200) {
            this.createModalForm({
                id: 'formEditProducto',
                autofill: dataProduct.data,
                data: { opc: 'editProducto', id },
                bootbox: {
                    title: '<strong>Editar Producto</strong>',
                    size: ''
                },
                json: [
                    { opc: 'input', lbl: 'Nombre del Producto', id: 'name', class: 'col-12 mb-3', tipo: 'texto', required: true },
                    { opc: 'input', lbl: 'Precio', id: 'price', class: 'col-12 mb-3', tipo: 'cifra', required: true },
                    {
                        opc: 'select',
                        id: 'id_classification',
                        lbl: 'Clasificación',
                        data: clasificacion,
                        class: 'col-12',
                        required: true
                    },
                ],
                success: (response) => {
                    if (response.status == 200) {
                        alert({ icon: 'success', text: response.message });
                        this.lsProductos();
                    } else {
                        alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });

            // Initialized
            $("#price").on('keyup', function () {
                let value = $(this).val();
                // Eliminar caracteres no numéricos ni punto
                value = value.replace(/[^0-9.]/g, '');
                // Permitir solo un punto decimal
                const parts = value.split('.');
                if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                }
                $(this).val(value);
            });
        } else {
            alert({ icon: "error", title: "Oops!...", text: dataProduct.message, btn1: true, btn1Text: "Ok" });
        }
    }

    statusProducto(id, status) {
        const tr = $(event.target).closest("tr");
        const nombre = tr.find("td").eq(0).text();

        // Si está activo, cambiar a inactivo y viceversa
        const nuevoEstado = status == 1 ? '0' : 1;
        const mensaje = status == 1 ? '<span class="font-bold text-lg">desactivar</span>' : '<span class="font-bold text-lg">reactivar</span>';

        bootbox.confirm({
            title: `Confirmar cambio de estado`,
            message: `¿Deseas ${mensaje} el producto ${nombre}?`,
            buttons: {
                cancel: { label: 'Cancelar', className: 'btn-secondary' },
                confirm: { label: 'Confirmar', className: 'btn-danger' }
            },
            callback: (result) => {
                if (result) {
                    useFetch({
                        url: this._link,
                        data: {
                            opc: 'statusProducto',
                            active: nuevoEstado,
                            id: id
                        }
                    }).then((response) => {
                        if (response.status == 200) {
                            alert({ icon: 'success', text: response.message });
                            this.lsProductos();
                        } else {
                            alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                        }
                    });
                }
            }
        });
    }


    // INFORMACION DE CLASIFICACIONES
    filterBarClasificaciones() {
        const container = $("#tab-clasificaciones");
        container.html('<div id="filterbar-clasificaciones" class="mb-2"></div><div id="tabla-clasificaciones"></div>');

        this.createfilterBar({
            parent: "filterbar-clasificaciones",
            data: [
                {
                    opc: "select",
                    id: "estado_clasificaciones",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    'onchange': () => this.lsClasificaciones()
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    id: "btnNuevaClasificacion",
                    text: "Nueva Clasificación",
                    onClick: () => this.addClasificacion(),
                },
            ],
        });

        $('#estado_clasificaciones').on('change', () => this.lsClasificaciones());

        setTimeout(() => this.lsClasificaciones(), 50);
    }

    lsClasificaciones() {
        this.createTable({
            parent: "tabla-clasificaciones",
            idFilterBar: "filterbar-clasificaciones",
            data: { opc: "listClasificaciones" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbClasificaciones",
                theme: 'dark',
             
                center: [2]
            },
        });
    }

    addClasificacion() {
        this.createModalForm({
            id: 'formModalClasificacion',
            data: { opc: 'addClasificacion' },
            bootbox: {
                title: '<strong>Nueva Clasificación</strong>',
                size: ''
            },
            json: [
                { opc: 'input', lbl: 'Nombre de la Clasificación', id: 'classification', class: 'col-12 mb-3', tipo: 'texto', required: true },
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsClasificaciones();
                } else {
                    alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editClasificacion(id) {
        let dataClass = await useFetch({ url: this._link, data: { opc: 'getClasificacion', id } });

        if (dataClass.status == 200) {
            this.createModalForm({
                id: 'formEditClasificacion',
                autofill: dataClass.data,
                data: { opc: 'editClasificacion', id },
                bootbox: {
                    title: '<strong>Editar Clasificación</strong>',
                    size: ''
                },
                json: [
                    { opc: 'input', lbl: 'Nombre de la Clasificación', id: 'classification', class: 'col-12 mb-3', tipo: 'texto', required: true },
                ],
                success: (response) => {
                    if (response.status == 200) {
                        alert({ icon: 'success', text: response.message });
                        this.lsClasificaciones();
                    } else {
                        alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        } else {
            alert({ icon: "error", title: "Oops!...", text: dataClass.message, btn1: true, btn1Text: "Ok" });
        }
    }

    statusClasificacion(id, status) {
        const tr = $(event.target).closest("tr");
        const nombre = tr.find("td").eq(0).text();

        // Si está activo, cambiar a inactivo y viceversa
        const nuevoEstado = status == 1 ? '0' : 1;
        const mensaje = status == 1 ? '<span class="font-bold text-lg">desactivar</span>' : '<span class="font-bold text-lg">reactivar</span>';

        bootbox.confirm({
            title: `Confirmar cambio de estado`,
            message: `¿Deseas ${mensaje} la clasificación ${nombre}?`,
            buttons: {
                cancel: { label: 'Cancelar', className: 'btn-secondary' },
                confirm: { label: 'Confirmar', className: 'btn-danger' }
            },
            callback: (result) => {
                if (result) {
                    useFetch({
                        url: this._link,
                        data: {
                            opc: 'statusClasificacion',
                            active: nuevoEstado,
                            id: id
                        }
                    }).then((response) => {
                        if (response.status == 200) {
                            alert({ icon: 'success', text: response.message });
                            this.lsClasificaciones();
                        } else {
                            alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                        }
                    });
                }
            }
        });
    }
}

// Funciones auxiliares
function validationInputForNumber(objeto) {
    let value = $(objeto).val();
    // Eliminar caracteres no numéricos ni punto
    value = value.replace(/[^0-9.]/g, '');
    // Permitir solo un punto decimal
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    $(objeto).val(value);
}