class CustomOrder extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "customOrder";
        this.currentStep = 0;
        this.selectedOptions = {};
        this.numeroPorciones = 1;
        this.editMode = false;
        this.editingOrderId = null;
        this.editingCustomId = null;
    }

    render() {
        this.currentStep = 0;
        this.selectedOptions = {};
        this.numeroPorciones = 1;
        this.editMode = false;
        this.editingOrderId = null;
        this.editingCustomId = null;
        custom.modalAddCustomOrder();
    }

    async renderEdit(orderPackageId, custom_id) {
        this.editMode = true;
        this.editingOrderId = orderPackageId;
        this.editingCustomId = custom_id;


        // Cargar datos del pedido personalizado
        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'getCustomOrderByPackageId',
                id: orderPackageId
            }
        });

        if (response.status == 200 && response.data) {
            const orderData = response.data;

            // Cargar imágenes del pedido
            const imagesResponse = await useFetch({
                url: this._link,
                data: {
                    opc: 'getOrderImages',
                    order_package_id: orderPackageId
                }
            });

            orderData.images = imagesResponse.status == 200 ? imagesResponse.data : [];

            // Resetear selecciones
            this.selectedOptions = {};
            this.numeroPorciones = orderData.portion_qty || 1;

            // Reconstruir selectedOptions desde los items guardados
            if (orderData.items && Array.isArray(orderData.items)) {
                orderData.items.forEach(item => {
                    const category = categories.find(cat =>
                        cat.options && cat.options.some(opt => opt.id == item.modifier_id)
                    );

                    if (category) {
                        const option = category.options.find(opt => opt.id == item.modifier_id);
                        const isMulti = category.isExtra == 1 || /decoraci/i.test(category.name || "");

                        if (isMulti) {
                            if (!Array.isArray(this.selectedOptions[category.id])) {
                                this.selectedOptions[category.id] = [];
                            }

                            // Buscar si el producto ya existe en el array
                            const existingItem = this.selectedOptions[category.id].find(i => i.id == option.id);

                            if (existingItem) {
                                // Si existe, sumar la cantidad
                                existingItem.qty += parseInt(item.quantity || 1);
                            } else {
                                // Si no existe, agregarlo
                                this.selectedOptions[category.id].push({
                                    id: option.id,
                                    name: option.name,
                                    price: parseFloat(item.price || 0),
                                    qty: parseInt(item.quantity || 1)
                                });
                            }
                        } else {
                            this.selectedOptions[category.id] = {
                                id: option.id,
                                name: option.name,
                                price: parseFloat(item.price || 0)
                            };
                        }
                    }
                });
            }

            // Abrir modal con datos precargados
            this.modalAddCustomOrder(orderData);
        } else {
            bootbox.alert("No se pudo cargar el pedido personalizado.");
        }
    }

    modalAddCustomOrder(orderData = null) {
        const isEdit = this.editMode && orderData;
        const html = `
                <div id="pastelModalRoot" class="w-full">
                    <main class="max-w-6xl mx-auto px-6 py-6 space-y-10" id="modalContent">

                        <!-- Título y subtítulo -->
                        <section class="text-center space-y-4">
                            <h2 class="text-4xl font-bold text-violet-300">
                                ${isEdit ? '✏️ Editar tu pastel personalizado' : '¡Bienvenido a tu experiencia de repostería!✨'}
                            </h2>
                            <p class="text-lg text-gray-300 max-w-2xl mx-auto">
                                ${isEdit ? 'Modifica los detalles de tu pedido personalizado.' : 'Personaliza cada detalle para hacer algo único y delicioso.'}
                            </p>
                        </section>

                        <!-- Progreso -->
                        <section class="bg-gray-800 border border-gray-700 rounded-xl px-6 py-4 shadow space-y-3" id="progressSection">
                        </section>

                        <!-- Contenido principal -->
                        <section class="grid lg:grid-cols-3 gap-8">
                            <!-- Columna izquierda -->
                            <div class="lg:col-span-2 space-y-6">

                                <!-- Sección de opciones -->
                                <div id="optionsSection" class="space-y-6"></div>

                                <!-- 🧱 Sección de observaciones y fotos -->
                                <div id="extraContainer" class="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4"></div>
                            </div>

                            <!-- Sección de vista previa -->
                            <div id="previewSection"
                                class="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow space-y-2">
                            </div>
                        </section>

                        <!-- Botones -->
                        <div class="flex justify-end mt-3 px-6 pb-6">
                            <button id="btnCancelar" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700 me-2" onclick="bootbox.hideAll()">Cancelar</button>
                            <button id="btnGuardar" class="border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30">${isEdit ? 'Actualizar' : 'Guardar'}</button>
                        </div>
                    </main>
                </div>
            `;

        const modalCustom = bootbox.dialog({
            title: `🎂 ${isEdit ? 'Editar pastel' : '¡Arma tu pastel!'}`,
            size: "extra-large",
            id: "modalArmarPastel",
            closeButton: true,
            message: html,
        });

        modalCustom.on("shown.bs.modal", async function () {
            custom.renderProgress();
            custom.renderOptions();
            custom.renderPreview();
            custom.renderNavigation();
            custom.actualizarEstilosPasos();
            custom.renderExtraSection();

            // Precargar datos si es modo edición
            if (isEdit && orderData) {
                // Usar setTimeout para asegurar que el DOM esté listo
                setTimeout(() => {
                    $("#dedication").val(orderData.dedication || '');
                    $("#order_details").val(orderData.order_details || '');
                    $("#precioReal").val(orderData.price_real || '');

                    // Mostrar imágenes existentes
                    if (orderData.images && orderData.images.length > 0) {
                        console.log('Cargando imágenes:', orderData.images);
                        custom.renderExistingImages(orderData.images);
                    }
                }, 100);
            }

            $("#btnGuardar").on("click", function () {
                const canClose = custom.handleFinished(orderData?.name);
            });
        });

        modalCustom.on("hidden.bs.modal", function () {
            // Resetear modo edición al cerrar
            custom.editMode = false;
            custom.editingOrderId = null;
        });
    }

    // Renderiza el progreso del pedido
    renderProgress() {
        // Html
        const parent = $("#progressSection");
        parent.html(`
                <div class="flex justify-between items-center">
                    <div class="flex gap-3 items-center">
                    <span class="text-violet-400 text-xl">👨‍🍳</span>
                    <div>
                        <h3 class="text-lg font-semibold text-violet-300">
                        Progreso de tu pastel
                        </h3>
                        <p id="progresoTexto" class="text-sm text-gray-400">
                        0 de 5 pasos completados
                        </p>
                    </div>
                    </div>
                    <span id="progresoBadge" class="px-3 py-1 text-sm font-medium rounded-full bg-violet-700/30 text-violet-300">0 / 5</span>
                </div>

                <div class="w-full bg-gray-700 rounded h-3 overflow-hidden">
                    <div id="barraProgreso" class="bg-violet-500 h-3 transition-all duration-500" style="width: 0%"></div>
                </div>

                <div class="flex justify-between text-sm text-gray-500 font-medium" id="stepButtonsContainer">
                </div>
            `);

        // Verificar la data (viene de app)
        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            parent.append('<div class="text-red-400">Error: No se encontraron modificadores de pastel.</div>');
            return;
        }

        // FUNCIONALIDAD.
        // Variables
        const $progresoTexto = parent.find("#progresoTexto");
        const $progresoBadge = parent.find("#progresoBadge");
        const $barraProgreso = parent.find("#barraProgreso");
        const $stepButtonsContainer = parent.find("#stepButtonsContainer").empty();
        const categorias = categories;
        let completados = 0;


        // Botones de paso
        categories.forEach((cat, index) => {
            const $btn = $(`
                <button class="step-button flex flex-col items-center min-w-[80px] gap-1 p-2 rounded-lg text-xs ${index === 0 ? "bg-violet-700/30 text-violet-300" : "text-gray-500 hover:text-violet-300"}">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-violet-500 text-white" : "bg-gray-700"}">${index + 1}</div>
                    <span class="hidden sm:block">${cat.name}</span>
                </button>
                `);
            $btn.on("click", function () {
                custom.currentStep = index;
                custom.renderProgress();
                custom.renderOptions();
                custom.renderNavigation();
                custom.actualizarEstilosPasos();
            });
            $stepButtonsContainer.append($btn);
        });

        // Calcula progreso
        categorias.forEach(cat => {
            const sel = custom.selectedOptions[cat.id];
            const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");
            const done = isMulti ? (Array.isArray(sel) && sel.length > 0) : !!sel;

            if (done) completados++;
        });

        const porcentaje = (completados / categorias.length) * 100;
        $barraProgreso.css("width", porcentaje + "%");
        $progresoBadge.text(`${completados} / ${categorias.length}`);
        $progresoTexto.text(
            completados === categorias.length
                ? "¡Tu pastel está listo! 🎉"
                : `${completados} de ${categorias.length} pasos completados`
        );

        // Actualizar estilos
        let $stepButtons = parent.find(".step-button");
        custom.actualizarEstilosPasos($stepButtons);
    }

    // Renderiza las opciones del paso actual
    renderSingleOptions(cat) {
        const $opcionesPaso = $("#opcionesPaso").empty();
        const searchValue = custom.searchByCategory?.[cat.id] || "";
        const selected = custom.selectedOptions[cat.id];

        let options = cat.options || [];

        if (searchValue.trim() !== "") {
            const term = searchValue.toLowerCase();
            options = options.filter(o =>
                o.name?.toLowerCase().includes(term)
            );
        }

        options.forEach(opt => {
            const isSelected = selected && selected.id === opt.id;

            const $btn = $(`
                <button
                    type="button"
                    class="text-xs group border border-gray-700 px-4 py-2 rounded-lg
                        flex items-center justify-between gap-3 transition-all
                        ${isSelected
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-105 border-transparent"
                    : "hover:bg-gray-700 text-gray-200"}"
                >
                    <span class="flex-1 break-words">${opt.name}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full
                        ${isSelected ? "bg-white/20" : "bg-gray-700 text-gray-300"}">
                        ${custom.formatPrice(opt.price)}
                    </span>
                </button>
            `);

            $btn.on("click", () => {
                custom.selectedOptions[cat.id] =
                    isSelected ? null : {
                        id: opt.id,
                        name: opt.name,
                        price: parseFloat(opt.price || 0)
                    };

                custom.renderProgress();
                custom.renderSingleOptions(cat);
                custom.renderPreview();
                custom.renderNavigation();
                custom.actualizarEstilosPasos();
            });

            $opcionesPaso.append($btn);
        });
    }

    renderOptions() {
        const parent = $("#optionsSection").empty();
        if (!categories || !Array.isArray(categories) || categories.length === 0) return;

        const cat = categories[custom.currentStep];
        if (!cat) return;

        parent.append(`
            <div class="flex justify-end items-center">
                <div class="flex gap-2">
                    <button id="btnAnterior" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700">Anterior</button>
                    <button id="btnSiguiente" class="border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30">Siguiente</button>
                </div>
            </div>

            <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow space-y-2">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <span class="text-3xl">🔷</span>
                        <p class="text-lg font-bold text-violet-300">
                            Paso ${custom.currentStep + 1}: ${cat.name}
                        </p>
                    </div>
                </div>

                <div id="opcionesPaso" class="grid md:grid-cols-2 gap-4 pt-3"></div>
            </div>
        `);

        const $opcionesPaso = parent.find("#opcionesPaso");

        const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");

        /* =====================================================
           🔍 OPCIONES NO MÚLTIPLES (con búsqueda corregida)
        ===================================================== */
        if (!isMulti) {
            custom.searchByCategory ??= {};
            const searchValue = custom.searchByCategory[cat.id] || "";

            $opcionesPaso.before(`
                <div class="mb-3">
                    <input
                        type="text"
                        id="searchOptionInput"
                        class="w-full border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2"
                        placeholder="Buscar opción..."
                        value="${searchValue.replace(/"/g, "&quot;")}"
                    />
                </div>
            `);

            $("#searchOptionInput")
                .off("input")
                .on("input", function () {
                    custom.searchByCategory[cat.id] = this.value;
                    custom.renderSingleOptions(cat); // 👈 clave
                });

            // render inicial
            custom.renderSingleOptions(cat);

        } else {
            // Interfaz para varias selecciones (Select + cantidad + botón)
            const $uiWrap = $(`
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex flex-wrap items-end gap-3">
                            <div class="flex-1 min-w-[220px]">
                                <label class="block text-xs text-gray-400 mb-1">Decoración</label>
                                <select id="decorSelect" class="w-full border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2">
                                    ${(cat.options || []).map(o => `<option value="${o.id}">${o.name}</option>`).join("")}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Cantidad</label>
                                <input id="decorQty" type="number" min="1" value="1" class="w-24 border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2 text-right"/>
                            </div>
                            <div>
                                <label class="block text-xs text-transparent mb-1">.</label>
                                <button id="btnAddDecor" class="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-700 text-white" onclick="custom.handleAddDecor()">
                                    + Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                `);

            // Lista de decoraciones agregadas
            const $listWrap = $(`
                    <div class="col-span-1 md:col-span-2" id="listWrap">
                        <div id="decorScroll" class="max-h-[40vh] lg:max-h-[40vh] overflow-y-auto overscroll-contain">
                            <div id="decorList" class="space-y-3">
                                
                            </div>
                        </div>
                    </div>
                `);

            $opcionesPaso.append($uiWrap);
            $opcionesPaso.append($listWrap);

            custom.renderDecorList();
        }
    }

    // Render de la lista
    renderDecorList() {
        const cat = categories[custom.currentStep];
        if (!cat) return;
        if (!Array.isArray(custom.selectedOptions[cat.id])) custom.selectedOptions[cat.id] = [];
        let items = custom.selectedOptions[cat.id];
        const $parent = $("#decorScroll").find("#decorList").empty();

        if (!items.length) {
            $parent.html(`
                    <div class="text-sm text-gray-400 border border-dashed border-gray-700 rounded p-3 text-center">
                        No hay decoraciones agregadas.
                    </div>
                `);
            return;
        }

        items.forEach((it, i) => {
            const lineTotal = (parseFloat(it.price || 0) * (it.qty || 1));

            const $row = $(`
                    <div class="flex items-center justify-between gap-3 bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <div class="flex-1">
                            <div class="text-gray-200 font-medium">${it.name}</div>
                            <div class="text-xs text-gray-400">Precio unitario: ${formatPrice(it.price)}</div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button class="btn-minus border border-gray-700 rounded px-2 py-1 hover:bg-gray-700">−</button>
                            <input type="text" class="qty-input w-12 text-center border border-gray-700 bg-gray-800 text-gray-200 rounded px-2 py-1" value="${it.qty || 1}" />
                            <button class="btn-plus border border-gray-700 rounded px-2 py-1 hover:bg-gray-700">+</button>
                        </div>

                        <div class="w-28 text-right font-semibold text-emerald-400">${formatPrice(lineTotal)}</div>
                        <button class="btn-remove text-gray-400 hover:text-red-400" title="Quitar"><i class="icon-trash text-red-400 hover:text-red-500"></i></button>
                    </div>
                `);

            $row.find(".btn-minus").on("click", () => {
                items[i].qty = Math.max(1, (items[i].qty || 1) - 1);
                $row.find(".qty-input").val(items[i].qty);
                const newLineTotal = parseFloat(items[i].price || 0) * items[i].qty;
                $row.find(".w-28").text(formatPrice(newLineTotal));
                custom.renderPreview();
            });
            $row.find(".btn-plus").on("click", () => {
                items[i].qty = (items[i].qty || 1) + 1;
                $row.find(".qty-input").val(items[i].qty);
                const newLineTotal = parseFloat(items[i].price || 0) * items[i].qty;
                $row.find(".w-28").text(formatPrice(newLineTotal));
                custom.renderPreview();
            });
            $row.find(".qty-input").on("input", function () {
                let v = parseInt($(this).val() || "0", 10);
                if (Number.isNaN(v) || v < 1) v = 1;
                items[i].qty = v;
                const newLineTotal = parseFloat(items[i].price || 0) * v;
                $row.find(".w-28").text(formatPrice(newLineTotal));
                custom.renderPreview();
            });
            $row.find(".btn-remove").on("click", () => {
                items.splice(i, 1);
                custom.renderProgress();
                custom.renderOptions();
                custom.renderPreview();
                custom.renderNavigation();
                custom.actualizarEstilosPasos();
            });

            $parent.prepend($row);
        });
    }

    // Agrega una decoración
    handleAddDecor() {
        const $root = $("#modalArmarPastel");
        const cat = categories[custom.currentStep];
        if (!cat) return;

        const selectedId = parseInt($root.find("#decorSelect").val(), 10);
        const qty = parseInt($root.find("#decorQty").val(), 10) || 1;

        if (!selectedId) return;
        const option = (cat.options || []).find(o => o.id == selectedId);

        if (!option) return;
        if (!Array.isArray(custom.selectedOptions[cat.id])) custom.selectedOptions[cat.id] = [];


        const items = custom.selectedOptions[cat.id];
        const existing = items.find(i => i.id == selectedId);
        if (existing) {
            existing.qty = (existing.qty || 1) + qty;
        } else {
            items.push({ id: option.id, name: option.name, price: parseFloat(option.price || 0), qty });
        }
        custom.renderProgress();
        custom.renderOptions();
        custom.renderPreview();
        custom.renderNavigation();
        custom.actualizarEstilosPasos();
        custom.renderDecorList();
    }

    // Renderiza la vista previa y el precio sugerido
    renderPreview() {
        const parent = $("#previewSection").empty();
        parent.append(`
                <div class="flex items-center gap-1">
                    <div class="text-3xl animate-bounce">🎂</div>
                    <div class="flex flex-col">
                        <span class="text-lg font-bold text-violet-300">Vista previa de tu pastel 💜</span>
                        <div class="text-xs text-gray-400">El precio sugerido se basa en las porciones.</div>
                    </div>
                </div>
                <div class="mt-4">
                    <label for="porciones" class="block text-sm font-medium text-gray-300 mb-1">Número de porciones</label>
                    <input type="text" id="porciones" class="w-full border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2 text-right" oninput="custom.calculateSuggestedPrice(this)" />
                </div>
                <div id="previewDetails" class="space-y-1"></div>
                <div class="mt-4">
                    <label for="precioReal" class="block text-sm font-medium text-gray-300 mb-1">Precio real:</label>
                        <div class="flex items-center border border-gray-700 bg-gray-800 text-gray-200 rounded mt-2 w-full">
                            <span class="px-3 text-gray-400">$</span>
                            <input type="text"
                                    id="precioReal"
                                    class="w-full bg-gray-800 px-3 py-2 text-right"
                                    placeholder="Precio real"
                                    oninput="custom.formatCifra(this)">
                        </div>
                </div>
            `);

        const detalles = parent.find("#previewDetails").empty();


        if (!categories || !Array.isArray(categories) || categories.length == 0) return;

        let total = 0;

        categories.forEach(cat => {
            const sel = custom.selectedOptions[cat.id];
            if (!sel) return;

            const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");
            if (isMulti) {
                const items = Array.isArray(sel) ? sel : [];
                if (!items.length) return;
                detalles.append(`<div class="text-sm font-semibold text-violet-300 mt-3">${cat.name}</div>`);
                items.forEach(it => {
                    const lineTotal = parseFloat(it.price || 0) * (it.qty || 1);
                    total += lineTotal;
                    detalles.append(`
                            <div class="flex justify-between items-center border-t border-gray-700 py-1 text-sm">
                                <span class="text-gray-200"><span class="text-violet-300">x${it.qty || 1}</span> ${it.name}</span>
                                <span class="text-violet-400 font-semibold">${custom.formatPrice(lineTotal)}</span>
                            </div>
                        `);
                });
            } else {
                const lineTotal = parseFloat(sel.price || 0);
                total += lineTotal;
                detalles.append(`
                        <div class="grid grid-cols-3 items-center border-t border-gray-700 py-1 text-sm">
                            <span class="font-medium text-violet-300 justify-self-start">${cat.name}:</span>
                            <span class="text-gray-200 justify-self-start">${sel.name}</span>
                            <span class="text-violet-400 font-semibold justify-self-end">${custom.formatPrice(lineTotal)}</span>
                        </div>
                    `);
            }
        });


        if (total > 0) {
            detalles.append(`
                    <div class="flex justify-between items-center border-t border-violet-700 mt-2 pt-2 font-bold text-violet-300 text-sm">
                        <span>Subtotal:</span>
                        <span>${custom.formatPrice(total)}</span>
                    </div>

                    <div class="flex justify-between items-center  border-violet-700 pt-2 font-bold text-violet-300">
                        <span>Precio sugerido ✨:</span>
                        <span id="precioSugerido">$0.00</span>
                    </div>

                `);


            // 🧮 Si hay selección, inicializa el campo porciones y calcula automáticamente
            const $porciones = $("#porciones");
            const porciones = custom.numeroPorciones || 1;
            $porciones.val(porciones);

            // Llama directamente a tu función de cálculo con el input actual
            custom.calculateSuggestedPrice($porciones[0]);
        } else {
            $("#porciones").val("1");
            $("#precioSugerido").text("$0.00");
        }
    }

    // Renderiza la navegación (botones anterior/siguiente)
    renderNavigation() {
        const $btnAnterior = $("#btnAnterior");
        const $btnSiguiente = $("#btnSiguiente");
        if (!categories || !Array.isArray(categories) || categories.length === 0) return;

        $btnAnterior.prop("disabled", custom.currentStep == 0);
        $btnSiguiente.prop("disabled", custom.currentStep == categories.length - 1);

        $btnAnterior.off("click").on("click", () => {
            if (custom.currentStep > 0) custom.currentStep--;
            custom.renderProgress();
            custom.renderOptions();
            custom.renderPreview();
            custom.renderNavigation();
            custom.actualizarEstilosPasos();
        });
        $btnSiguiente.off("click").on("click", () => {
            if (custom.currentStep < categories.length - 1) custom.currentStep++;
            custom.renderProgress();
            custom.renderOptions();
            custom.renderPreview();
            custom.renderNavigation();
            custom.actualizarEstilosPasos();
        });
    }

    // Actualiza los estilos de los botones de paso según el estado
    actualizarEstilosPasos() {
        let parent = $("#stepButtonsContainer").find(".step-button");
        parent.each(function (index) {
            const $btn = $(this);
            const $circle = $btn.find("div").first();
            const cat = categories[index];
            const sel = cat ? custom.selectedOptions[cat.id] : null;

            // Detecta multi por flag o por nombre
            const isMulti = !!(cat && (cat.isExtra == 1 || /decoraci/i.test(cat.name || "")));
            const done = isMulti ? (Array.isArray(sel) && sel.length > 0) : !!sel;

            if (index === custom.currentStep) {
                // Paso actual
                $btn
                    .removeClass("text-gray-500 hover:text-violet-300 text-green-500 bg-violet-700/30 text-violet-300 hover:text-purple-600")
                    .addClass("bg-violet-700/30 text-violet-300");

                $circle
                    .removeClass("bg-gray-700 bg-green-500")
                    .addClass("bg-violet-500 text-white");
            } else if (done) {
                // Paso completado
                $btn
                    .removeClass("bg-violet-700/30 text-violet-300 text-gray-500 hover:text-violet-300 hover:text-purple-600")
                    .addClass("text-green-500");

                $circle
                    .removeClass("bg-gray-700 bg-violet-500")
                    .addClass("bg-green-500 text-white");
            } else {
                // Paso pendiente
                $btn
                    .removeClass("bg-violet-700/30 text-violet-300 text-green-500 hover:text-purple-600")
                    .addClass("text-gray-500 hover:text-violet-300");

                $circle
                    .removeClass("bg-violet-500 bg-green-500 text-white")
                    .addClass("bg-gray-700");
            }
        });
    }

    // Renderiza fotos, dedicatoria y observaciones
    renderExtraSection() {
        const parent = $("#extraContainer").empty();
        parent.append(`
                <form id="formEditProducto" novalidate="true">
                    <div class="col-12 mb-3">
                        <label class="">Dedicatoria</label>
                            <input id="dedication" name="dedication" required="required" class="form-control input-sm bg-[#1F2A37]" onkeyup="">
                    </div>
                    <div>
                        <label class="">Observaciones</label>
                        <textarea class="form-control bg-[#1F2A37] resize" id="order_details" name="order_details"></textarea>
                    </div>

                    <div class="col-12 mt-3 mb-2">
                        <div class="w-full p-2 border-2 border-dashed border-gray-500 rounded-xl text-center">
                            <input
                                type="file"
                                id="archivos"
                                name="archivos"
                                class="hidden"
                                multiple
                                accept="image/*"
                                onchange="normal.previewImages(this, 'previewImagenes')"
                            >
                            <div class="flex flex-col items-center justify-center py-2 cursor-pointer" onclick="document.getElementById('archivos').click()">
                                <div class="w-28 h-28 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                                    <i class="icon-upload text-white"></i>
                                </div>
                                <p class="text-xs">Drag & Drop or <span class="text-purple-400 underline">choose file</span></p>
                                <p class="text-[10px] text-gray-400 mt-1">JPEG, PNG</p>
                            </div>
                            <div id="previewImagenes" class="flex gap-2 flex-wrap mt-1"></div>
                        </div>
                    </div>
                </form>
            `);

        $("#formEditProducto").on("submit", function (e) {
            e.preventDefault(); // 🛑 Evita el envío automático
        });
    }


    handleFinished(existingName = null) {
        const $root = $("#modalArmarPastel");
        const payload = [];
        let total = 0;

        const isMultiCategory = (cat) => {
            return !!(cat && (cat.isExtra == 1 || /decoraci/i.test(cat.name || "")));
        };

        categories.forEach(cat => {
            const sel = custom.selectedOptions[cat.id];
            const multi = isMultiCategory(cat);

            if (multi) {
                (Array.isArray(sel) ? sel.filter(it => it && it.qty >= 1) : [])
                    .forEach(it => {
                        const qty = parseInt(it.qty) || 1;
                        const price = parseFloat(it.price || 0);
                        total += price * qty;
                        payload.push({ modifier_id: it.id, quantity: qty, price });
                    });
            } else if (sel?.id != null) {
                const price = parseFloat(sel.price || 0);
                total += price;
                cat.options.forEach(opt => {
                    if (opt.id === sel.id) payload.push({ modifier_id: opt.id, quantity: 1, price });
                });
            }
        });


        // 🔸 Nueva validación: debe haber al menos una selección
        if (payload.length == 0) {
            bootbox.alert({
                title: "Selecciona al menos una opción",
                message: `Por favor selecciona al menos una categoría o elemento antes de continuar.`
            });
            return false;
        }

        // Limpieza visual (si existía algún resaltado anterior)
        $root.find(".step-button").removeClass("ring-2 ring-red-500");

        // 🧾 Mostrar resultados en consola (para depurar)
        console.log("Payload listo para backend:", payload);

        const totalSugerido = $root.find("#precioSugerido").text().replace(/[^0-9.-]+/g, "");
        const priceRealStr = $root.find("#precioReal").val().replace(/,/g, "");

        let priceReal = parseFloat(priceRealStr) || total;
        const dedication = $root.find("#dedication").val().trim();
        const orderDetails = $root.find("#order_details").val().trim();


        if (priceRealStr == "") {
            bootbox.dialog({
                title: "<strong>ACEPTAS EL PRECIO SUGERIDO❓ 👀⚠️</strong>",
                message: `No has ingresado un precio real. Si continúas, se tomará el precio sugerido de <strong>$${totalSugerido}</strong> como el precio real del pedido. ¿Deseas continuar?`,
                buttons: {
                    cancel: {
                        label: 'Cancelar',
                        className: 'btn-secondary',
                        callback: function () {
                            // No hacer nada, solo cerrar
                        }
                    },
                    accept: {
                        label: 'Aceptar',
                        className: 'btn-primary',
                        callback: function () {
                            priceReal = totalSugerido;
                            // 📝 Pedir nombre del pedido personalizado (solo si es nuevo)
                            if (custom.editMode && existingName) {
                                // Modo edición: usar nombre existente
                                custom.saveCustomOrder(existingName, payload, totalSugerido, priceReal, orderDetails, dedication);
                            } else {
                                // Modo creación: pedir nombre
                                bootbox.prompt({
                                    title: "Nombre del pedido personalizado",
                                    inputType: 'text',
                                    placeholder: "Ejemplo: Pastel de cumpleaños para Ana",
                                    value: existingName || '',
                                    callback: function (result) {
                                        if (result) {
                                            custom.saveCustomOrder(result, payload, totalSugerido, priceReal, orderDetails, dedication);
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            });
            return false;
        } else {

            // 📝 Pedir nombre del pedido personalizado (solo si es nuevo)
            if (custom.editMode && existingName) {
                // Modo edición: usar nombre existente
                custom.saveCustomOrder(existingName, payload, totalSugerido, priceReal, orderDetails, dedication);
            } else {
                // Modo creación: pedir nombre
                bootbox.prompt({
                    title: "Nombre del pedido personalizado",
                    inputType: 'text',
                    placeholder: "Ejemplo: Pastel de cumpleaños para Ana",
                    value: existingName || '',
                    callback: function (result) {
                        if (result) {
                            custom.saveCustomOrder(result, payload, totalSugerido, priceReal, orderDetails, dedication);
                        }
                    }
                });
            }
        }


        return true;
    }


    // Guarda el pedido personalizado
    async saveCustomOrder(orderName, payload, totalSuggested, priceReal, orderDetails, dedication) {

        const now = new Date();
        const mysqlDatetime = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');

        let response;

        if (custom.editMode && custom.editingOrderId) {
            // MODO EDICIÓN: Actualizar pedido existente
            const orderData = {
                name: orderName,
                price: totalSuggested,
                price_real: priceReal,
                portion_qty: custom.numeroPorciones || 1,
                items: JSON.stringify(payload),
                idCustom: custom.editingCustomId,
                id: custom.editingOrderId,
            };
            response = await useFetch({ url: this._link, data: { opc: "editCustomOrder", ...orderData } });
        } else {
            // MODO CREACIÓN: Crear nuevo pedido
            const orderData = {
                name: orderName,
                price: totalSuggested,
                price_real: priceReal,
                portion_qty: custom.numeroPorciones || 1,
                date_created: mysqlDatetime,
                orderId: idFolio || null,
                items: JSON.stringify(payload)
            };
            response = await useFetch({ url: this._link, data: { opc: "addCustomOrder", ...orderData } });
        }


        if (response.status == 200) {
            // GUARDAR DEDICATORIA Y OBSERVACIONES
            const responseOrder = await useFetch({
                url: custom._link,
                data:
                {
                    opc: "editOrderPackage",
                    order_details: orderDetails,
                    dedication: dedication,
                    id: response.data.orderId,
                }
            });

            // GUARDAR IMÁGENES
            const form = document.getElementById('formEditProducto');
            const formData = new FormData(form);

            formData.append('opc', 'addOrderImages');
            formData.append('id', response.data.orderId);
            formData.append('idFolio', idFolio);

            const files = document.getElementById('archivos').files;

            for (let i = 0; i < files.length; i++) {
                formData.append('archivos[]', files[i]);
            }

            fetch(custom._link, {
                method: 'POST',
                body: formData
            }).then(response => response.json()).then(response => { });

            // SI GUARDÓ DEDICATORIA Y OBS, ENTONCES RETORNA SUCCESS.
            if (responseOrder.status == 200) {
                const successMsg = custom.editMode
                    ? "¡Tu pedido personalizado ha sido actualizado con éxito! ✨"
                    : "¡Tu pedido personalizado ha sido guardado con éxito! 🎉";
                bootbox.alert(successMsg);
            }

            // OBTENER LA LISTA DE PEDIDOS RELACIONADOS ALA ORDEN PRINCIPAL.
            const listaProductosDeLaOrden = await useFetch({
                url: 'ctrl/ctrl-pedidos.php',
                data: {
                    opc: "getProductsOrder",
                    order_id: idFolio
                }
            });

            normal.showOrder(listaProductosDeLaOrden.data || []);

            bootbox.hideAll();
        } else {
            bootbox.alert("Error al guardar el pedido personalizado.");
            throw new Error(`Error del servidor: ${response.status}`);
        }
    }


    handleAddOption() {
        // Abrir modal para agregar nueva opción
        const cat = categories[custom.currentStep];
        if (!cat) return;

        const modalAddOption = bootbox.dialog({
            title: `Crea nueva opción a ${cat.name}`,
            size: "small",
            id: "modalAddOption",
            closeButton: true,
            message: `
                    <div class="w-full">
                        <main class="max-w-md mx-auto p-2" id="modalContentOption">
                            <div class="space-y-4">
                                <div>
                                    <label for="newOptionName" class="block text-sm font-medium text-gray-300 mb-1">Nombre de la opción</label>
                                    <input type="text" id="newOptionName" class="w-full border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2" placeholder="" />
                                </div>
                                <div>
                                    <label for="newOptionPrice" class="block text-sm font-medium text-gray-300 mb-1">Precio x unidad (opcional)</label>
                                    <input type="text" id="newOptionPrice" class="w-full border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2 text-right" placeholder="0.00" oninput="custom.formatCifra(this)" />
                                </div>
                            </div>
                        </main>
                    </div>
                `,
            buttons: {
                cancel: {
                    label: "Cancelar",
                    className: "border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700",
                    callback: function () {
                        // No hacer nada, solo cerrar
                    }
                },
                confirm: {
                    label: "Agregar",
                    className: "border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30",
                    callback: async function () {
                        const optionName = $("#newOptionName").val().trim();
                        const optionPriceStr = $("#newOptionPrice").val().replace(/,/g, "");
                        const optionPrice = parseFloat(optionPriceStr) || 0;
                        if (optionName) {
                            const response = await useFetch({ url: custom._link, data: { opc: "addModifierProduct", modifier_id: cat.id, name: optionName, price: optionPrice } });
                            if (response.status == 200) {
                                custom.addOptionToCategory(cat.id, optionName, optionPrice, response.data.id);
                            }
                        }
                    }
                }
            }
        });

    }

    addOptionToCategory(categoryId, optionName, optionPrice = 0, optionId = null) {
        const cat = categories.find(c => c.id == categoryId);
        if (!cat) return;
        if (!Array.isArray(cat.options)) cat.options = [];
        const newId = cat.options.length > 0 ? Math.max(...cat.options.map(o => o.id)) + 1 : 1;
        cat.options.push({ id: optionId || newId, name: optionName, price: optionPrice });
        custom.renderOptions();
    }

    // Funciones auxiliares.
    formatPrice(price) {
        const num = parseFloat(price) || 0;
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    formatCifra(input) {
        // Quitar caracteres que no sean dígitos o punto
        let valor = input.value.replace(/[^0-9.]/g, "");

        // Permitir solo un punto decimal
        let partes = valor.split(".");
        if (partes.length > 2) {
            valor = partes[0] + "." + partes[1]; // conservar solo la primera parte decimal
        }

        // Si empieza con punto, corregir a "0."
        if (valor.startsWith(".")) {
            valor = "0" + valor;
        }

        // Separar parte entera y decimal
        let [entero, decimal] = valor.split(".");

        // Formatear parte entera con separador de miles
        if (entero) {
            entero = new Intl.NumberFormat("es-MX").format(entero);
        }

        // Reconstruir valor con decimal (si existe)
        input.value = decimal !== undefined ? `${entero}.${decimal}` : entero || "";
    }

    calculateSuggestedPrice(inputPorciones) {
        const $root = $("#modalArmarPastel");
        if ($root.length == 0) return; // No hacer nada si el modal no está abierto

        // Primero normaliza/limpia el input con la función formatCifra
        custom.formatCifra(inputPorciones);
        // 📜 Regla:
        // PrecioSugerido = (SubtotalNoMultiples * Porciones) + SubtotalMultiples

        // 🔵 Identifica categorías múltiples (extras/decoración)
        const isMultiCategory = (cat) => !!(cat && (cat.isExtra == 1 || /decoraci/i.test(cat.name || "")));

        // 📌 Acumuladores separados
        let baseTotal = 0; // NO-múltiples (sabores, rellenos, etc.) → se multiplican por porciones
        let multiTotal = 0; // Múltiples (extras, decoración)       → NO se multiplican por porciones

        categories.forEach(cat => {
            const sel = custom.selectedOptions[cat.id];
            const multi = isMultiCategory(cat);

            // Normaliza a lista para manejar single/multiple de forma uniforme
            const items = Array.isArray(sel)
                ? sel.filter(it => it && (parseInt(it.qty, 10) || 1) >= 1)
                : (sel && sel.id != null ? [sel] : []);

            items.forEach(it => {
                const qty = parseInt(it.qty, 10) || 1;
                const price = parseFloat(it.price || 0);

                if (multi) {
                    // Extras/decoración → NO se multiplican por porciones
                    multiTotal += price * qty;
                } else {
                    // Sabores/rellenos → SÍ se multiplican por porciones (más adelante)
                    baseTotal += price * qty;
                }
            });
        });

        // 🧮 Porciones y precio sugerido final
        const numeroPorciones = parseFloat(inputPorciones.value) || 1;
        custom.numeroPorciones = numeroPorciones;

        const totalSugerido = (baseTotal * numeroPorciones) + multiTotal;

        // 📝 Salida UI
        $root.find("#precioSugerido").text(custom.formatPrice(totalSugerido));
    }

    renderExistingImages(images) {
        console.log('renderExistingImages llamado con:', images);
        const $preview = $("#previewImagenes");
        console.log('Contenedor encontrado:', $preview.length);

        if ($preview.length === 0) {
            console.error('No se encontró el contenedor #previewImagenes');
            return;
        }

        $preview.empty();

        if (!images || images.length == 0) {
            console.log('No hay imágenes para mostrar');
            return;
        }

        images.forEach((img, index) => {
            console.log('Procesando imagen:', img);
            const imageUrl = img.path && img.path.startsWith('http')
                ? img.path
                : `https://huubie.com.mx/${img.path || img.image_path || ''}`;

            const $imgContainer = $(`
                    <div class="relative image-preview-container" style="display: inline-block;">
                        <img src="${imageUrl}"
                            alt="${img.original_name || img.name || 'Imagen'}"
                            class="w-28 h-28 object-cover rounded-lg border-2 border-purple-400"
                            onerror="console.error('Error cargando imagen:', '${imageUrl}')" onclick="custom.showLargeImage('${imageUrl}')"/>
                        <button type="button"
                                class="delete-image-btn"
                                data-image-id="${img.id}"
                                style="position: absolute; top: -8px; right: -8px; background-color: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; opacity: 0; transition: opacity 0.2s, background-color 0.2s;">
                            <i class="icon-cancel" style="font-size: 12px;"></i>
                        </button>
                    </div>
                `);

            // Agregar eventos hover para mostrar/ocultar botón
            $imgContainer.on('mouseenter', function () {
                $(this).find('.delete-image-btn').css('opacity', '1');
            });

            $imgContainer.on('mouseleave', function () {
                $(this).find('.delete-image-btn').css('opacity', '0');
            });

            // Agregar evento click al botón de eliminar
            $imgContainer.find('.delete-image-btn').on('click', function () {
                custom.removeExistingImage(img.id, this);
            });

            // Hover effect en el botón
            $imgContainer.find('.delete-image-btn').on('mouseenter', function () {
                $(this).css('background-color', '#dc2626');
            }).on('mouseleave', function () {
                $(this).css('background-color', '#ef4444');
            });

            $preview.append($imgContainer);
        });

        console.log('Imágenes renderizadas:', images.length);
    }

    async removeExistingImage(imageId, buttonElement) {
        const confirmed = await new Promise(resolve => {
            bootbox.confirm({
                message: "Estás seguro de eliminar esta imagen?",
                buttons: {
                    confirm: { label: 'Sí', className: 'btn-danger' },
                    cancel: { label: 'No', className: 'btn-secondary' }
                },
                callback: resolve
            });
        });

        if (confirmed) {
            const response = await useFetch({
                url: this._link,
                data: {
                    opc: 'deleteOrderImage',
                    id: imageId
                }
            });

            if (response.status == 200) {
                $(buttonElement).closest('.relative').fadeOut(300, function () {
                    $(this).remove();
                });
            } else {
                bootbox.alert("No se pudo eliminar la imagen.");
            }
        }
    }

    showLargeImage(imageUrl) {
        bootbox.dialog({
            title: 'Vista ampliada',
            message: `<div class='flex justify-center items-center'><img src='${imageUrl}' class='max-w-full max-h-[80vh] rounded-lg border-2 border-purple-400' /></div>`,
            size: 'large',
            closeButton: true
        });
    }

}
