let app, category, client, mod, product;

let cat,modifier;
const api = "../pedidos/ctrl/ctrl-admin.php";

$(async () => {

    const data     = await useFetch({ url: api, data: { opc: "init" } });
          cat      = data.category;
          modifier = data.modifier;

    app      = new App(api, "root");
    category = new Category(api, "root");
    client   = new Client(api, "root");
    mod      = new Modifier(api, "root");
    product  = new ProductModifier(api, "root");

    app.render();

});





class App extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Admin";
        this.dataProducto = [];
    }

    render() {
        this.layout();

        this.filterBarProductos();
        this.lsProductos();
        category.lsCategory();
        client.lsClient();
        // product.lsModifiers();

    }

    layout() {

        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
            class: 'flex mx-2 my-2 min-h-screen mt-5 p-2',
            card: {
                filterBar: { class: 'w-full my-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-3 h-full bg-[#1F2A37] rounded-lg p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        // init layouts
        this.layoutTabs();
        category.filterBarCategory();
        client.filterBarClient();
        mod.filterBarModifiers();
        product.filterBar();
    }

    layoutTabs() {
        this.tabLayout({
            parent: "container" + this.PROJECT_NAME,
            id: "tabsPedidos",
            content: { class: "" },
            theme: "dark",
            type: "short",
            json: [
                {
                    id: "productos",
                    tab: "Productos",
                    class: "mb-1",
                    active: true,
                    onClick: () => this.lsProductos(),
                },
                {
                    id: "categoria",
                    tab: "Categoría",
                    onClick: () => category.lsCategory(),
                },
                {
                    id: "modifier",
                    tab: "Modificadores",
                    class: "mb-1",
                    onClick: () => mod.lsModifiers(),

                },

                {
                    id: "productsModifier",
                    tab: "Productos Modificadores",
                    class: "mb-1",
                    onClick: () => product.ls(),

                },

                {
                    id: "cliente",
                    tab: "Clientes",
                    onClick: () => client.lsClient(),
                },
            ],
        });

        $("#container" + this.PROJECT_NAME).prepend(`
        <div class="px-4 pt-3 pb-3">
            <h2 class="text-2xl font-semibold text-white">📦 Administrador</h2>
            <p class="text-gray-400">Gestiona productos, categorías y clientes.</p>
        </div>`);
    }

    filterBarProductos() {
        const container = $("#container-productos");
        container.html('<div id="filterbar-productos" class="mb-2"></div><div class="h-100" id="tabla-productos"></div>');

        this.createfilterBar({
            parent: "filterbar-productos",
            data: [
                {
                    opc: "select",
                    id: "estado",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: ' app.lsProductos()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoProducto",
                    text: "Nuevo Producto",
                    onClick: () => this.addProducto(),
                },
            ],
        });


    }

    // Productos

    lsProductos() {
        this.createTable({
            parent: "tabla-productos",
            idFilterBar: "idFilterBar",
            data: { opc: "listProductos" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbProductos",
                theme: 'dark',
                right: [2],
                center: [1, 3, 6]
            },
        });
    }

    addProducto() {
        const modal = bootbox.dialog({
            closeButton: true,
            title: 'Agregar Producto',
            message: `<div><form id="formAddProducto" novalidate></form></div>`
        });

        this.createForm({
            id: 'formAddProductoInternal',
            parent: 'formAddProducto',
            autovalidation: false,
            data: [],
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Producto",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input-group",
                    id: "price",
                    lbl: "Precio",
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    icon: "icon-dollar",
                    onkeyup: "validationInputForNumber('#price')"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                },
                {
                    opc: "select",
                    id: "category_id",
                    lbl: "Clasificación",
                    class: "col-12",
                    text: "classification",
                    data: cat,
                    // value: "id"
                },
                {
                    opc: "div",
                    id: "image",
                    lbl: "Foto del producto",
                    class: "col-12 mt-2",
                    html: `
                    <div class="col-12 mb-2">
                        <div class="w-full p-2 border-2 border-dashed border-gray-500 rounded-xl text-center">
                            <input
                                type="file"
                                id="archivos"
                                name="archivos"
                                class="hidden"
                                multiple
                                accept="image/*"
                                onchange="app.previewImages(this, 'previewImagenes')"
                            >
                            <div class="flex flex-col items-center justify-center py-2 cursor-pointer" onclick="document.getElementById('archivos').click()">
                                <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                                    <i class="icon-upload text-white"></i>
                                </div>
                                <p class="text-xs">Drag & Drop or <span class="text-purple-400 underline">choose file</span></p>
                                <p class="text-[10px] text-gray-400 mt-1">JPEG, PNG</p>
                            </div>
                            <div id="previewImagenes" class="flex gap-2 flex-wrap mt-1"></div>
                        </div>
                    </div>
                `
                },
                {
                    opc: "button",
                    id: "btnAddProducto",
                    class: "col-12 mt-2",
                    className: "w-full p-2",
                    text: "Guardar Producto",
                    onClick: () => {
                        const form = document.getElementById('formAddProducto');
                        const formData = new FormData(form);

                        formData.append('opc', 'addProduct');

                        const files = document.getElementById('archivos').files;
                        for (let i = 0; i < files.length; i++) {
                            formData.append('archivos[]', files[i]);
                        }

                        fetch(this._link, {
                            method: 'POST',
                            body: formData
                        })
                            .then(response => response.json())
                            .then(response => {
                                if (response.status === 200) {
                                    alert({ icon: "success", text: response.message });
                                    this.lsProductos();
                                    modal.modal('hide');
                                } else {
                                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                                }
                            });
                    }
                }
            ]
        });
    }

    async editProducto(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getProducto", id: id },
        });

        const producto = request.data;

        const modal = bootbox.dialog({
            closeButton: true,
            title: 'Editar Producto',
            message: `<div><form id="formProductoEdit" novalidate></form></div>`
        });

        this.createForm({
            id: 'editProduct',
            parent: 'formProductoEdit',
            autofill: producto,
            autovalidation: false,
            data: [],

            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Producto",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input-group",
                    id: "price",
                    lbl: "Precio",
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    icon: "icon-dollar",
                    onkeyup: "validationInputForNumber('#price')"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                },
                {
                    opc: "select",
                    id: "category_id",
                    lbl: "Clasificación",
                    class: "col-12",
                    data: cat,
                    text: "classification",
                    value: "id"
                },
                {
                    opc: "div",
                    id: "image",
                    lbl: "Fotos o videos del producto",
                    class: "col-12 mt-3",
                    html: `
                    <div class="col-12 mb-2">
                        <div class="w-full p-2 border-2 border-dashed border-gray-500 rounded-xl text-center">
                            <input
                                type="file"
                                id="archivos"
                                name="archivos"
                                class="hidden"
                                multiple
                                accept="image/*"
                                onchange="app.previewImages(this, 'previewImagenes')"
                            >
                            <div class="flex flex-col items-center justify-center py-2 cursor-pointer" onclick="document.getElementById('archivos').click()">
                                <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                                    <i class="icon-upload text-white"></i>
                                </div>
                                <p class="text-xs">Drag & Drop or <span class="text-purple-400 underline">choose file</span></p>
                                <p class="text-[10px] text-gray-400 mt-1">JPEG, PNG</p>
                            </div>
                            <div id="previewImagenes" class="flex gap-2 flex-wrap mt-1"></div>
                        </div>
                    </div>
                `
                },
                {
                    opc: "button",
                    id: "btnModalProducto",
                    class: "col-12 mt-2",
                    className: "w-full p-2",
                    text: "Actualizar producto",
                    onClick: () => {
                        const form = document.getElementById("formProductoEdit");
                        const formData = new FormData(form);

                        formData.append("opc", "editProduct");
                        formData.append("id", id);

                        const files = document.getElementById('archivos').files;
                        for (let i = 0; i < files.length; i++) {
                            formData.append('archivos[]', files[i]);
                        }

                        fetch(this._link, {
                            method: "POST",
                            body: formData
                        })
                            .then(response => response.json())
                            .then(response => {
                                if (response.status === 200) {
                                    alert({ icon: "success", text: response.message });
                                    this.lsProductos();
                                    modal.modal('hide');
                                } else {
                                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                                }
                            });
                    }
                }
            ]
        });

        this.renderImages(producto.image, 'previewImagenes');
    }


    async editProduct(id) {

        const request = await useFetch({
            url: this._link,
            data: { opc: "getProducto", id: id },
        });

        const producto = request.data;

        this.createModalForm({
            id: 'formProductoEdit',
            data: { opc: 'editProducto', id: producto.id },
            bootbox: {
                title: 'Editar Producto',
            },
            autofill: producto,
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Producto",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "price",
                    lbl: "Precio",
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    onkeyup: "validationInputForNumber('#price')"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                },
                {
                    opc: "select",
                    id: "category_id",
                    lbl: "Clasificación",
                    class: "col-12",
                    data: cat,
                    text: "classification",
                    value: "id"
                },
                {
                    opc: "div",
                    id: "image",
                    lbl: "Fotos o videos del producto",
                    class: "col-12 mt-3",
                    html: `
                     <div class="col-12 mb-2">
                        <div class="w-full p-2 border-2 border-dashed border-gray-500 rounded-xl text-center">
                            <input
                                type="file"
                                id="archivos"
                                name="archivos"
                                class="hidden"
                                multiple
                                accept="image/*"
                                onchange="app.previewImages(this, 'previewImagenes')"
                            >
                            <div class="flex flex-col items-center justify-center py-2 cursor-pointer" onclick="document.getElementById('archivos').click()">
                                <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                                    <i class="icon-upload text-white"></i>
                                </div>
                                <p class="text-xs">Drag & Drop or <span class="text-purple-400 underline">choose file</span></p>
                                <p class="text-[10px] text-gray-400 mt-1">JPEG, PNG</p>
                            </div>
                            <div id="previewImagenes" class="flex gap-2 flex-wrap mt-1"></div>
                        </div>
                    </div>
                `
                }


            ],
            success: (response) => {
                this.lsProductos();
            },
        });

        this.renderImages(producto.image, 'previewImagenes')
    }

    statusProducto(id, active) {
        this.swalQuestion({
            opts: {
                title: "¿Desea cambiar el estado del Producto? ",
                text: "Esta acción ocultará o reactivará el producto.",
                icon: "warning",
            },

            data: {
                opc: "statusProducto",
                active: active === 1 ? 0 : 1,
                id: id,
            },

            methods: {
                send: () => this.lsProductos(),
            },
        });
    }

    // aux method.
    previewImages(input, previewId) {
        const previewContainer = document.getElementById(previewId);
        previewContainer.innerHTML = "";
        Array.from(input.files).forEach(file => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.classList.add("w-20", "h-20", "object-cover", "rounded");
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    renderImages(images, previewId) {
        const previewContainer = document.getElementById(previewId);
        previewContainer.innerHTML = ""; // Limpia el contenedor

        const urlBase = 'https://huubie.com.mx/';

        // Si solo es una imagen (objeto), conviértelo a arreglo
        const imageList = Array.isArray(images) ? images : [{ path: images }];

        console.log(imageList);

        imageList.forEach(imgData => {
            const img = document.createElement("img");
            img.src = urlBase + imgData.path;
            img.alt = imgData.original_name || "Imagen del producto";
            img.classList.add("w-20", "h-20", "object-cover", "rounded", "border");
            previewContainer.appendChild(img);
        });
    }

}
class Category extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Categorias";
    }


    filterBarCategory() {
        const container = $("#container-categoria");
        container.html('<div id="filterbar-category" class="mb-2"></div><div id="table-category"></div>');

        this.createfilterBar({
            parent: "filterbar-category",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: ' category.lsCategory()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewCategory",
                    text: "Nueva categoria ",
                    onClick: () => this.addCategory(),
                },
            ],
        });
    }

    lsCategory() {
        this.createTable({
            parent: "table-category",
            idFilterBar: "filterbar-category",
            data: { opc: "listCategory" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbCategory",
                theme: 'dark'
            },
        });
    }

    addCategory() {
        this.createModalForm({
            id: 'formCategoryAdd',
            data: { opc: 'addCategory' },
            bootbox: {
                title: 'Agregar categoria',
            },
            json: [
                {
                    opc: "input",
                    id: "classification",
                    lbl: "Nombre de la categoría",
                    class: "col-12 mb-3"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsCategory();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editCategory(id) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getCategories",
                id: id,
            },
        });


        const data = request.data;

        this.createModalForm({
            id: 'formCategoriaEdit',
            data: { opc: 'editCategory', id: id },
            bootbox: {
                title: 'Editar Categoría',
            },
            autofill: data,
            json: [
                {
                    opc: "input",
                    id: "classification",
                    lbl: "Nombre de la categoría",
                    class: "col-12 mb-3"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsCategory();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message });
                }
            }
        });
    }

    statusCategory(id, estado) {

        this.swalQuestion({

            opts: {
                title: "¿Desea cambiar el estado de la categoría?",
                text: "Esta acción activará o desactivará la categoría.",
                icon: "warning",
            },

            data: {

                opc: "statusCategory",
                active: estado === 1 ? 0 : 1,
                id: id,

            },

            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message });
                        this.lsCategory();
                    } else {
                        alert({ icon: "info", title: "Oops!...", text: response.message });
                    }
                }
            },
        });

    }

}
class Client extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Client";
    }

    filterBarClient() {
        const container = $("#container-cliente");
        container.html('<div id="filterbar-client" class="mb-2"></div><div id="table-client"></div>');

        this.createfilterBar({
            parent: "filterbar-client",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Disponibles" },
                        { id: "0", valor: "No disponibles" }
                    ],
                    onchange: ' client.lsClient()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewClient",
                    text: "Nuevo Cliente",
                    onClick: () => this.addClient(),
                },
            ],
        });
    }

    lsClient() {
        this.createTable({
            parent: "table-client",
            idFilterBar: "filterbar-client",
            data: { opc: "listClient" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbClient",
                theme: 'dark'
            },
        });
    }

    addClient() {
        this.createModalForm({
            id: 'formClientAdd',
            data: { opc: 'addClient' },
            bootbox: {
                title: 'Agregar Cliente',
            },
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Cliente",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "email",
                    lbl: "Correo Electrónico",
                    required: false,
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "phone",
                    lbl: "Teléfono",
                    class: "col-12 mb-3",
                    onkeyup: "client.validatePhone(this)"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsClient();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editClient(id) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getClient",
                id: id,
            },
        });

        const data = request.data;

        this.createModalForm({
            id: 'formClientEdit',
            data: { opc: 'editClient', id: id },
            bootbox: {
                title: 'Editar Cliente',
            },
            autofill: data,
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Cliente",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "email",
                    lbl: "Correo Electrónico",
                    required: false,
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "phone",
                    lbl: "Teléfono",
                    class: "col-12 mb-3",
                    onkeyup: "client.validatePhone(this)"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsClient();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message });
                }
            }
        });
    }

    deleteClient(id) {
        this.swalQuestion({
            opts: {
                title: "¿Desea eliminar este cliente?",
                text: "Esta acción cambiará el estado del cliente a inactivo.",
                icon: "warning",
            },
            data: {
                opc: "deleteClient",
                id: id,
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message });
                        this.lsClient();
                    } else {
                        alert({ icon: "info", title: "Oops!...", text: response.message });
                    }
                }
            },
        });
    }

    validatePhone(input) {
        // Solo permitir números y limitar a 10 dígitos
        let phone = input.value.replace(/\D/g, '');
        
        // Limitar a máximo 10 dígitos
        if (phone.length > 10) {
            phone = phone.substring(0, 10);
        }
        
        const phoneContainer = $(input).closest('.form-group');
        
        // Remover mensaje anterior si existe
        phoneContainer.find('.phone-validation').remove();
        
        // Mostrar mensajes de validación
        if (phone.length > 0 && phone.length < 10) {
            const remaining = 10 - phone.length;
            const message = $(`<small class="phone-validation text-warning d-block mt-1"><i class="icon-info-circled"></i> Faltan ${remaining} dígito${remaining > 1 ? 's' : ''} (${phone.length}/10)</small>`);
            phoneContainer.append(message);
        } else if (phone.length === 10) {
            const message = $('<small class="phone-validation text-success d-block mt-1"><i class="icon-ok-circled"></i> Teléfono válido ✓</small>');
            phoneContainer.append(message);
        }
        
        // Asignar el valor limitado al input
        input.value = phone;
    }
}

class Modifier extends App {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Modifier";
    }

    filterBarModifiers() {
        const container = $("#container-modifier");
        container.html(`
            <div id="filterbar-modifiers" class="mb-2"></div>
            <div id="tabla-modifiers"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-modifiers",
            data: [
                {
                    opc: "select",
                    id: "status",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: 'mod.lsModifiers()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoModifier",
                    text: "Nuevo Modificador",
                    onClick: () => this.addModifier(),
                },
            ],
        });

        setTimeout(() => this.lsModifiers(), 50);
    }

    lsModifiers() {
        this.createTable({
            parent: "tabla-modifiers",
            idFilterBar: "filterbar-modifiers",
            data: { opc: "listModifier" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbModifiers",
                theme: 'dark',
                center: [3]
            },
        });
    }

    async addModifier() {

        bootbox.dialog({
            closeButton: false,
            size: 'large',
            title: `
            <h2 class="text-lg font-semibold leading-none tracking-tight text-gray-100">Crear Nuevo Modificador</h2>
            <p class="text-sm text-muted-foreground">Completa la información del modificador.</p>
        `,
            message: `
            <form id="formModifierContainer" novalidate></form>
            <div id="infoModifier" class="w-full my-3 d-none">
                    <label class="text-lg font-medium text-gray-100">Productos Incluidos</label>
                    <p class="text-sm text-muted-foreground mb-1">Añade los productos que incluye este modificador</p>
            </div>
            <form id="formProductsContainer" novalidate class="border border-gray-500 rounded p-3 my-3 d-none"></form>
            <div id="product-list" class="overflow-y-auto max-h-52 mt-2"></div>
        `,
            buttons: {

                cerrar: {
                    label: 'Cerrar',
                    className: 'btn btn-secondary',
                    callback: () => {
                        mod.lsModifiers();
                    }

                },
                // actualizar: {
                //     label: 'Guardar Modificador',
                //     className: 'btn btn-primary',
                //     callback: () => {

                //         useFetch({
                //             url: this._link,
                //             data: {
                //                 opc: 'updateModifier',
                //                 name: $('#name').val(),
                //                 id: this.idModifier
                //                 // productos: JSON.stringify(this.tempProductList)
                //             },
                //             success: (res) => {
                //                 if (res.status == 200) {
                //                     Swal.fire("✔", "Modificador actualizado correctamente", "success");
                //                 } else {
                //                     Swal.fire("Error", res.message || "No se pudo actualizar", "error");
                //                 }
                //             }
                //         });

                //         return false;
                //     }
                // },
            }
        });

        this.createForm({
            parent: "formModifierContainer",
            id: "formModifier",
            data: { opc: 'addModifier' },
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Modificador",
                    required: true,
                    class: "col-8 ",
                },

                {
                    opc: "btn-submit",
                    text: "Crear ",
                    class: "col-4",
                    id: "btnCrearModificador"
                },
                {
                    opc: "div",
                    id: "extraSwitch",
                    class: "col-12 mb-2",
                    html: `
                    <div class="flex items-center justify-between p-3 rounded-lg border border-[#2A2E45] ">
                        <div>
                            <p class="text-xs text-muted-foreground">No se incluye en el cálculo por porción</p>
                        </div>

                        <label class="inline-flex items-center cursor-pointer relative">
                            <input type="checkbox" id="toggleAnticipo" class="sr-only peer" onchange="mod.toggleExtraFields()" />
                            <div class="w-11 h-6 bg-[#2E3148] peer-checked:bg-violet-600 rounded-full transition-colors duration-300"></div>
                            <div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 peer-checked:translate-x-5"></div>
                        </label>
                    </div>

                    <div id="referenciaExtra" class="text-amber-400 bg-amber-950/30 border border-amber-800 p-3 mt-3 text-sm rounded-lg hidden">
                        <p><i class=" icon-info-circled-3 text-amber-400 mr-1"></i> Este modificador se cobrará por unidad completa.</p>
                    </div>

                    <input type="hidden" name="isExtra" id="isExtra" value="0" />
                    `
                }

            ],
            success: (response) => {
                if (response.status == 200) {
                    this.idModifier = response.id;
                    // $('#btnCrearModificador').prop('disabled', true); // Deshabilita el botón
                    $('#formProductsContainer').removeClass('d-none');
                    $('#infoModifier').removeClass('d-none');
                    this.renderProductForm(response.id);
                    $('#btnCrearModificador').closest('.col-12').remove();
                } else if (response.status == 400) {
                    alert({
                        icon: "warning",
                        title: "Atención",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editModifier(id) {

        const response = await useFetch({
            url: this._link,
            data: { opc: "getModifier", id: id },
        });


        bootbox.dialog({
            closeButton: false,
            size: 'large',
            title: `
            <h2 class="text-lg font-semibold leading-none tracking-tight text-gray-100">Editar Modificador</h2>
            <p class="text-sm text-muted-foreground">Completa la información del modificador.</p> `,
            message: `
                <form id="formModifierContainer" novalidate></form>
                <div class="w-full my-3">
                    <label class="text-lg font-medium text-gray-100">Productos Incluidos</label>
                    <p class="text-sm text-muted-foreground mb-1">Añade los productos que incluye este modificador</p>
                </div>
                <form id="formProductsContainer" novalidate class="border border-gray-500 rounded p-3 my-3"></form>
                <div id="product-list" class="overflow-y-auto max-h-52 mt-2"></div>
        `,
            buttons: {


                cerrar: {
                    label: 'Cancelar',
                    className: 'btn btn-secondary',

                    callback: () => {
                        mod.lsModifiers();
                    }
                },


                actualizar: {
                    label: 'Guardar Modificador',
                    className: 'btn btn-primary',
                    callback: async () => {

                        // Actualizar modificador
                        const save = await useFetch({
                            url: this._link,
                            data: {
                                name: $("#formModifier [name='name']").val(),
                                opc: "editModifier",
                                id: id,
                            },
                        });

                        this.lsModifiers();

                        return false;
                    }
                },

            }
        });

        // renders.

        this.createForm({
            parent: "formModifierContainer",
            id: "formModifier",
            autofill: response.data,
            data: { opc: "editModifier", id: id },
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Modificador",
                    required: true,
                    class: "col-12 ",
                },


            ],

        });

        this.renderProductForm(id);

        this.renderProductListComponent(response.ls, id);

        // Complements.


    }

    statusModifier(id, active) {
        this.swalQuestion({
            opts: {
                title: "¿Desea cambiar el estado del Modificador? ",
                text: "Esta acción ocultará o reactivará el modificador.",
                icon: "warning",
            },

            data: {
                opc: "statusModifier",
                active: active === 1 ? 0 : 1,
                id: id,
            },

            methods: {
                send: () => this.lsModifiers(),
            },
        });
    }

    async showProducts(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getModifier", id }
        });

        let data = request.data;

      

        const modal = bootbox.dialog({
            closeButton: false,
            className: "modal fade show",
            title: `<h2 class="text-lg text-white font-bold"><i class="icon-product text-purple-400"></i> Información del modificador </h2>`,
            message: `<div><form id="containerShowProduct" novalidate></form></div>`,
            buttons: {
                ok: {
                    label: 'Cerrar',
                    className: 'btn-secondary',
                }
            }
        });

        // view.

        this.productListCard({
            parent  : "containerShowProduct",
            title   : 'Nombre ' ,
            subtitle: data ? data.name : 'Sin nombre',
            json    : request.ls || []
        });
    }

    productListCard(options = {}) {
        const defaults = {
        parent: "root",
        id: "productListCard",
        title: "Título del Paquete",
        subtitle: "Descripción del paquete o condiciones",
        json: [],
        };

        const opts = Object.assign({}, defaults, options);
        const total = opts.json.length;

        const wrapper = $(`
        <div id="${opts.id}" class="px-4">
            <h2 class="text-sm text-gray-400 ">${opts.title}</h2>
            <p class="text-lg  font-bold mb-2  text-white">${opts.subtitle}</p>

            <div class="flex justify-between items-center mt-4 mb-2 mx-2">
            <h3 class="text-md font-semibold text-white">📦 Lista de productos</h3>
            <span class="text-sm text-gray-400">Total: ${total}</span>
            </div>

            <div class="overflow-y-auto max-h-80 space-y-2 scroll-thin scroll-thumb-gray-600 scroll-track-transparent">
            </div>
        </div>
        `);

        const listContainer = wrapper.find(".overflow-y-auto");

        opts.json.forEach(item => {
        const card = $(`
            <div class="product-item" data-id="${item.id}">
            <div class="border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-4 mb-2">
                <div class="flex-1 truncate">
                <span class="text-sm font-semibold text-white block">${item.name}</span>
                </div>
                <div class="flex items-center gap-2">
                <label class="text-sm text-gray-400">Precio:</label>
                <span class="text-sm text-gray-400 font-medium">${formatPrice(item.price)}</span>
                </div>
            </div>
            </div>
        `);
        listContainer.append(card);
        });

        $(`#${opts.parent}`).html(wrapper);
    }

    // product modifier.

    renderProductForm(id) {
        this.createForm({
            parent: "formProductsContainer",
            id: "formProduct",
            data: { opc: "addProductModifier", modifier_id: id },
            json: [

                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del producto",
                    placeholder: "Ej: Vainilla, Fresa..",
                    required: true,
                    class: "col-5 ",
                },

                {
                    opc: "input",
                    id: "price",
                    lbl: "Precio ($) ",
                    tipo: "cifra",
                    placeholder: "0.00",
                    required: false,
                    class: "col-3",
                },
                {
                    opc: "btn-submit",
                    text: "Agregar",
                    class: "col-4",
                    onclick: 'alert()'
                },


            ],

            success: (response) => {
                if (response.status == 200) {
                    // Resetear el formulario
                    $("#formProduct")[0].reset();
                    $("#formProduct #name").val('');
                    $("#formProduct #price").val('');
                    
                    this.renderProductListComponent(response.data, id);
                } else if (response.status == 400) {
                    alert({
                        icon: "warning",
                        title: "Atención",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });

        $("#formProduct").on('reset', () => {
            $("formProduct #name").val('');
            $("formProduct #price").val('');

        });



            $('#formProduct #name').autocomplete({
                source: [
                    "Sergio",

                    "Loana",
                    "ATYÑ",
                    "Natural Flor",
                    "Balboa",
                    "Yahabibi",
                    "Flores-e Vallarta",
                    "LIDIA"
                ]
        });

    }

    renderProductListComponent(data, idModifier) {
        const container = $("<div>", {
            id: "product-list",
            class: "space-y-3",
        });

      data.forEach((prod, idx) => {
        const item = $(`
            <div class="flex items-center space-x-3 p-3 bg-muted/20 border border-border rounded-lg" data-index="${idx}">
                <div class="flex-1">
                    <p class="font-medium text-sm text-foreground">${prod.name}</p>
                </div>

                <div class="flex items-center space-x-2">
                    <span class="text-xs text-muted-foreground">Cant:</span>
                    <input
                        disabled
                        type="number"
                        min="1"
                        value="1"
                        class="form-control input-sm w-16 h-8 text-sm text-center text-foreground rounded-md bg-[#1F2A37] border border-border px-3 py-1 shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                </div>

                <div class="flex items-center space-x-2">
                    <span class="text-xs text-muted-foreground">$</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value="${prod.price !== null ? prod.price : '0.00'}"
                        class="form-control input-sm w-20 h-8 text-sm text-right text-foreground rounded-md bg-[#1F2A37] border border-border px-3 py-1 shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] price-input"
                        data-index="${idx}"
                        data-id="${prod.id}"
                        onblur="mod.updateProductPrice(this, ${idModifier})"
                        onkeypress="if(event.key === 'Enter') mod.updateProductPrice(this, ${idModifier})"
                    />
                </div>

            <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-md size-9 h-8 w-8
                    text-red-500
                    hover:bg-[#3B1B2B] hover:text-red-400
                    transition-colors duration-200
                    focus-visible:ring-ring/50 focus-visible:ring-[3px]
                    btn-remove-product"
                data-index="${idx}"
                data-id="${prod.id}">
                <i class="icon-trash text-sm"></i>
            </button>
            </div>
        `);

    container.append(item);
});


        $("#product-list").html(container);

        // Evento eliminar
        $("#product-list")
            .off("click", ".btn-remove-product")
            .on("click", ".btn-remove-product", async function () {
                const index = $(this).data("index");
                const id = $(this).data("id");

                const res = await useFetch({
                    url: api,
                    data: {
                        opc: "deleteProductModifier",
                        active: 0,
                        idProduct: idModifier,
                        id: id,
                    },
                });

                if (res.status == 200) {
                    mod.renderProductListComponent(res.data, idModifier);
                }
            });
    }

    // Complements.
    toggleExtraFields() {
        const isChecked = document.getElementById("toggleAnticipo").checked;

        // Mostrar/ocultar sección informativa
        document.getElementById("referenciaExtra").classList.toggle("hidden", !isChecked);

        // Actualizar valor del input hidden
        document.getElementById("isExtra").value = isChecked ? 1 : 0;
    }

    async updateProductPrice(input, modifierId) {
        const productId = $(input).data('id');
        const newPrice = parseFloat(input.value) || 0;
        
        // Validar que el precio sea válido
        if (newPrice < 0) {
            input.value = 0;
            alert({
                icon: "warning",
                title: "Precio inválido",
                text: "El precio no puede ser negativo",
                timer: 2000
            });
            return;
        }

        // Mostrar indicador de carga
        $(input).addClass('border-yellow-500').prop('disabled', true);
        
        try {
            const response = await useFetch({
                url: this._link,
                data: {
                    opc: "updateProductModifierPrice",
                    id: productId,
                    price: newPrice
                }
            });

            if (response.status === 200) {
                // Éxito - mostrar indicador verde brevemente
                $(input).removeClass('border-yellow-500').addClass('border-green-500');
                
                setTimeout(() => {
                    $(input).removeClass('border-green-500').prop('disabled', false);
                }, 500);
                
                // Mostrar notificación de éxito
                // alert({
                //     icon: "success",
                //     text: "Precio actualizado correctamente",
                //     timer: 1500,
                //     showConfirmButton: false
                // });
                
            } else {
                throw new Error(response.message || 'Error al actualizar precio');
            }
            
        } catch (error) {
            // Error - mostrar indicador rojo y restaurar valor anterior
            $(input).removeClass('border-yellow-500').addClass('border-red-500');
            
            setTimeout(() => {
                $(input).removeClass('border-red-500').prop('disabled', false);
            }, 2000);
            
            alert({
                icon: "error",
                title: "Error",
                text: error.message || "No se pudo actualizar el precio",
                timer: 3000
            });
            
            // Restaurar el valor anterior (opcional)
            // input.value = input.defaultValue;
        }
    }



}

class ProductModifier extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "modifierProduct";
    }

    init() {
        this.render();
    }

    filterBar() {
        $("#container-productsModifier").html(`
            <div id="filterbar${this.PROJECT_NAME}" class="mb-2"></div>
            <div id="container${this.PROJECT_NAME}" class="mb-2"></div>

        `);


        this.createfilterBar({
            parent: `filterbar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "estado",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "product.ls()"
                },
                {
                    opc: "select",
                    id: "modifier",
                    class: "col-12 col-md-3",
                    data: [
                        { valor: "Seleccionar todo", id: 0 },
                        ...modifier
                    ],
                    onchange: "product.ls()"
                },

                {
                    opc: "button",
                    id: "btnNuevo",
                    text: "Nuevo Modificador",
                    class: "col-12 col-md-3",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterbarmodifierProduct`,
            data: { opc: "lsModifierProduct", estado: $("#estado").val(), product_id: 1 },
            conf: { datatable: true, pag: 10 },
            coffeesoft: true,
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: "dark",
                center: [2, 4],
                right: [3]
            }
        });
    }

    add() {
        this.createModalForm({
            id: "formModifierAdd",
            data: { opc: "addProductModifier" },
            bootbox: { title: "Agregar Modificador" },
            json: this.jsonModifier(),
            success: (response) => {
                alert({ icon: response.status === 200 ? "success" : "error", text: response.message ,timer:1500});
                this.ls();
            }
        });
    }

    async editModifier(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getProductModifier", id: id } });
        const data = request.data;

        console.log(data);

        this.createModalForm({
            id: "formModifierEdit",
            data: { opc: "editProductModifier", id: id },
            bootbox: { title: "Editar Modificador" },
            autofill: data,
            json: this.jsonModifier(),
            success: (response) => {
                alert({ icon: response.status === 200 ? "success" : "error", text: response.message });
                this.ls();
            }
        });
    }

    statusModifier(id, active) {
        this.swalQuestion({
            opts: {
                title: "¿Cambiar estado del modificador?",
                icon: "warning"
            },
            data: {
                opc: "statusModifierProduct",
                active: active === 1 ? 0 : 1,
                id: id,
            },
            methods: {
                send: () => this.ls()
            }
        });
    }

    jsonModifier(){
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre",
                class: "col-12 mb-3"
            },
            {
                opc: "input-group",
                id: "price",
                lbl: "Precio",
                icon: 'icon-dollar',
                tipo: "cifra",
                required: false,
                placeholder: "0.00",

                class: "col-12 mb-3"
            },
            {
                opc: "select",
                id: "modifier_id",
                lbl: "Modificador",
                class: "col-12 mb-3",
                data: modifier,
                text: "valor",
                value: "id"
            },

        ];

    }
}





