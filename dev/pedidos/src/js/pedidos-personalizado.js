class CustomOrder extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "customOrder";
        this.currentStep = 0;
        this.selectedOptions = {};
    }

    render() {
        custom.modalAddCustomOrder();
    }

    modalAddCustomOrder() {
        const html = `
            <div id="pastelModalRoot" class="w-full">
                <main class="max-w-6xl mx-auto px-6 py-6 space-y-10" id="modalContent">

                    <!-- Título y subtítulo -->
                    <section class="text-center space-y-4">
                        <h2 class="text-4xl font-bold text-violet-300">
                            ¡Bienvenido a tu experiencia de repostería!✨
                        </h2>
                        <p class="text-lg text-gray-300 max-w-2xl mx-auto">
                            Personaliza cada detalle para hacer algo único y delicioso.
                        </p>
                    </section>

                    <!-- Progreso -->
                    <section class="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow space-y-4" id="progressSection">
                    </section>

                    <!-- Contenido principal -->
                    <section class="grid lg:grid-cols-3 gap-8">
                        <div class="lg:col-span-2 space-y-6" id="optionsSection"></div>
                        <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow space-y-2" id="previewSection"></div>
                    </section>

                    <!-- Botones -->
                    <div class="flex justify-end mt-3 px-6 pb-6">
                        <button id="btnCancelar" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700 me-2" onclick="bootbox.hideAll()">Cancelar</button>
                        <button id="btnGuardar" class="border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30">Guardar</button>
                    </div>
                </main>
            </div>
        `;

        const modalCustom = bootbox.dialog({
            title: `🎂 ¡Arma tu pastel!`,
            size: "extra-large",
            id: "modalArmarPastel",
            closeButton: true,
            message: html,
        });

        modalCustom.on("shown.bs.modal", function () {
            custom.renderProgress();
            custom.renderOptions();
            custom.renderPreview();
            custom.renderNavigation();
            custom.actualizarEstilosPasos();
        });
    }

    //* Renderiza el progreso del pedido */
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
            parent.append('<div class="text-red-400">Error: No se encontraron categorías de pastel.</div>');
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
                custom.renderPreview();
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

    //* Renderiza las opciones del paso actual */
    renderOptions() {
        const parent = $("#optionsSection").empty();
        if (!categories || !Array.isArray(categories) || categories.length == 0) return;

        const cat = categories[this.currentStep];
        if (!cat) return;

        // Renderiza las opciones
        parent.append(`
            <!-- Botones de navegación -->
            <div class="flex justify-end items-center">
                <div class="flex gap-2">
                    <button id="btnAnterior" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700">Anterior</button>
                    <button id="btnSiguiente" class="border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30">Siguiente</button>
                </div>
            </div>

            <!-- Opciones para armar tu pastel -->
            <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow space-y-2">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-3xl">🔷</span>
                            <p id="tituloPaso" class="text-lg font-bold text-violet-300">Paso ${this.currentStep + 1}: ${cat.name}</p>
                        </div>
                    </div>
                    <div>
                        <button id="btnAgregarOpcion" class="border border-gray-500 px-4 py-1 rounded-full text-sm text-gray-300 hover:bg-violet-700/30">+ Opción</button>
                    </div>
                </div>
                <div id="opcionesPaso" class="grid md:grid-cols-2 gap-4 pt-3">
                </div>
            </div>
        `);

        const $opcionesPaso = parent.find("#opcionesPaso");

        // MÚLTIPLES SELECCIONES (Decoraciones)
        const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");

        if (isMulti) {
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
                            <div class="text-sm text-gray-400 border border-dashed border-gray-700 rounded p-3 text-center">
                                No hay decoraciones agregadas.
                            </div>
                        </div>
                    </div>
                </div>
            `);

            $opcionesPaso.append($uiWrap);
            $opcionesPaso.append($listWrap);

            custom.renderDecorList();
        } else {
            const selected = this.selectedOptions[cat.id];
            (cat.options || []).forEach((opt) => {
                const isSelected = selected && selected.id === opt.id;
                const $btn = $(`
                    <button
                    class="group border border-gray-700 px-4 py-2 rounded-lg w-full transition-all duration-300
                            flex items-center justify-between gap-3
                            ${isSelected
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold scale-105 border-transparent"
                        : "hover:bg-gray-700 text-gray-200"}"
                    type="button">
                    <span class="truncate">${opt.name}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full
                                ${isSelected ? "bg-white/20 text-white" : "bg-gray-700 text-gray-300"}">
                        ${this.formatPrice(opt.price)}
                    </span>
                    </button>
                `);

                $btn.on("click", () => {
                    if (this.selectedOptions[cat.id] && this.selectedOptions[cat.id].id === opt.id) {
                        this.selectedOptions[cat.id] = null;
                    } else {
                        this.selectedOptions[cat.id] = { id: opt.id, name: opt.name, price: parseFloat(opt.price || 0) };
                    }
                    custom.renderProgress();
                    custom.renderOptions();
                    custom.renderPreview();
                    custom.renderNavigation();
                    custom.actualizarEstilosPasos();
                });

                $opcionesPaso.append($btn);
            });
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
                custom.renderProgress();
                custom.renderOptions();
                custom.renderPreview();
                custom.renderNavigation();
                custom.actualizarEstilosPasos();
            });
            $row.find(".btn-plus").on("click", () => {
                items[i].qty = (items[i].qty || 1) + 1;
                custom.renderProgress();
                custom.renderOptions();
                custom.renderPreview();
                custom.renderNavigation();
                custom.actualizarEstilosPasos();
            });
            $row.find(".qty-input").on("input", function () {
                let v = parseInt($(this).val() || "0", 10);
                if (Number.isNaN(v) || v < 1) v = 1;
                items[i].qty = v;
                custom.renderProgress();
                custom.renderOptions();
                custom.renderPreview();
                custom.renderNavigation();
                custom.actualizarEstilosPasos();
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
        custom.renderDecorList();
    }

    renderPreview() {
        const parent = $("#optionsSection").next().find("#preview").empty();
        if (!categories || !Array.isArray(categories) || categories.length === 0) return;

        let total = 0;
        categories.forEach(cat => {
            const sel = this.selectedOptions[cat.id];
            if (!sel) return;

            const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");
            if (isMulti) {
                const items = Array.isArray(sel) ? sel : [];
                if (!items.length) return;
                parent.append(`<div class="text-sm font-semibold text-violet-300 mt-3">${cat.name}</div>`);
                items.forEach(it => {
                    const lineTotal = parseFloat(it.price || 0) * (it.qty || 1);
                    total += lineTotal;
                    parent.append(`
                    <div class="flex justify-between items-center border-t border-gray-700 py-1 text-sm">
                        <span class="text-gray-200"><span class="text-violet-300">x${it.qty || 1}</span> ${it.name}</span>
                        <span class="text-violet-400 font-semibold">${this.formatPrice(lineTotal)}</span>
                    </div>
                `);
                });
            } else {
                const lineTotal = parseFloat(sel.price || 0);
                total += lineTotal;
                parent.append(`
                <div class="grid grid-cols-3 items-center border-t border-gray-700 py-1 text-sm">
                    <span class="font-medium text-violet-300 justify-self-start">${cat.name}:</span>
                    <span class="text-gray-200 justify-self-start">${sel.name}</span>
                    <span class="text-violet-400 font-semibold justify-self-end">${this.formatPrice(lineTotal)}</span>
                </div>
            `);
            }
        });

        if (total > 0) {
            let numeroPorciones = parseFloat($("#porciones").val()) || 1;
            let totalSugerido = total * numeroPorciones;
            parent.append(`
            <div class="flex justify-between items-center border-t border-violet-700 mt-2 pt-2 font-bold text-violet-300">
                <span>Total:</span>
                <span>${this.formatPrice(total)}</span>
            </div>
        `);
            $("#precioSugerido").text(this.formatPrice(totalSugerido));
        }
    }

    renderNavigation() {
        const $btnAnterior = $("#btnAnterior");
        const $btnSiguiente = $("#btnSiguiente");
        if (!categories || !Array.isArray(categories) || categories.length === 0) return;

        $btnAnterior.prop("disabled", this.currentStep === 0);
        $btnSiguiente.prop("disabled", this.currentStep === categories.length - 1);

        $btnAnterior.off("click").on("click", () => {
            if (this.currentStep > 0) this.currentStep--;
            custom.renderProgress();
            custom.renderOptions();
            custom.renderPreview();
            custom.renderNavigation();
            custom.actualizarEstilosPasos();
        });
        $btnSiguiente.off("click").on("click", () => {
            if (this.currentStep < categories.length - 1) this.currentStep++;
            custom.renderProgress();
            custom.renderOptions();
            custom.renderPreview();
            custom.renderNavigation();
            custom.actualizarEstilosPasos();
        });
    }

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
        if ($root.length === 0) return; // No hacer nada si el modal no está abierto

        // Primero normaliza/limpia el input con la función formatCifra
        this.formatCifra(inputPorciones);

        let total = 0;

        // Sumar todos los subtotales
        $root.find("#preview .text-violet-400").each(function () {
            const text = $(this).text().replace(/[^0-9.-]+/g, "");
            const num = parseFloat(text);
            if (!isNaN(num)) {
                total += num;
            }
        });

        // Ahora obtener porciones (ya limpias por formatCifra)
        let porcionesVal = $(inputPorciones).val().replace(/,/g, "");
        let numeroPorciones = parseFloat(porcionesVal) || 1;

        // Calcular sugerido
        let totalSugerido = total * numeroPorciones;
        $root.find("#precioSugerido").text(this.formatPrice(totalSugerido));
    }

    handleSave() {
        const $root = $("#modalArmarPastel");
        const missingCats = [];
        const payload = [];  // lo que enviarías al backend
        let total = 0;

        // Helper para detectar categoría multi (Decoraciones)
        const isMultiCategory = (cat) => {
            return !!(cat && (cat.isExtra == 1 || /decoraci/i.test(cat.name || "")));
        };

        // Función para marcar pasos incompletos
        const markIncompleteSteps = (missingIds = []) => {
            const set = new Set(missingIds);
            $root.find(".step-button").each(function (index) {
                const cat = categories[index];
                const $btn = $(this);
                if (cat && set.has(cat.id)) {
                    $btn.addClass("ring-2 ring-red-500");
                } else {
                    $btn.removeClass("ring-2 ring-red-500");
                }
            });
        };

        categories.forEach(cat => {
            const sel = this.selectedOptions[cat.id];
            const multi = isMultiCategory(cat);

            if (multi) {
                const items = Array.isArray(sel) ? sel.filter(it => it && (parseInt(it.qty, 10) >= 1)) : [];
                if (items.length === 0) {
                    missingCats.push({ id: cat.id, name: cat.name });
                } else {
                    // Totaliza y arma payload
                    const mapItems = items.map(it => {
                        const qty = parseInt(it.qty, 10) || 1;
                        const price = parseFloat(it.price || 0);
                        total += (price * qty);
                        return { id: it.id, name: it.name, price, qty };
                    });
                    payload.push({ categoryId: cat.id, category: cat.name, items: mapItems });
                }
            } else {
                if (!sel || sel.id == null) {
                    missingCats.push({ id: cat.id, name: cat.name });
                } else {
                    const price = parseFloat(sel.price || 0);
                    total += price;
                    payload.push({ categoryId: cat.id, category: cat.name, item: { id: sel.id, name: sel.name, price } });
                }
            }
        });

        if (missingCats.length > 0) {
            // Marca pasos incompletos y alerta
            markIncompleteSteps(missingCats.map(m => m.id));

            const lista = missingCats.map(m => `• ${m.name}`).join("<br>");
            bootbox.alert({
                title: "Faltan campos por completar",
                message: `Por favor completa las siguientes categorías antes de guardar:<br><br>${lista}`
            });
            return false; // evita que se cierre el modal
        }

        // Limpia marcas de error si todo OK
        markIncompleteSteps([]);

        // Si quieres ver el payload y total:
        console.log("Payload listo para backend:", payload);
        console.log("Total sugerido:", total);

        // Aquí puedes hacer tu POST al backend con 'payload' y 'total'
        // Ejemplo:
        // this.saveToBackend(payload, total);

        return true;
    }

    saveToBackend(payload, total) {
        // Método para enviar los datos al backend
        // Implementar según las necesidades específicas del proyecto
        console.log("Guardando en backend:", { payload, total });

        // Ejemplo de implementación:
        /*
        return useFetch({
            url: "ctrl/ctrl-pedidos.php",
            data: {
                opc: 'saveCustomOrder',
                payload: payload,
                total: total,
                porciones: $("#porciones").val(),
                precioReal: $("#precioReal").val()
            }
        }).then(response => {
            if (response.success) {
                bootbox.alert("Pedido guardado exitosamente");
                bootbox.hideAll();
            } else {
                bootbox.alert("Error al guardar el pedido: " + response.message);
            }
        });
        */
    }
}

// $uiWrap.find("#btnAddDecor").on("click", () => {
//     const idSel = String($uiWrap.find("#decorSelect").val());
//     const qty = Math.max(1, parseInt($uiWrap.find("#decorQty").val() || "1", 10));
//     const opt = (cat.options || []).find(o => String(o.id) === idSel);
//     if (!opt) return;

//     const idx = items.findIndex(it => String(it.id) === idSel);
//     if (idx >= 0) {
//         items[idx].qty = (items[idx].qty || 1) + qty;
//     } else {
//         items.push({ id: opt.id, name: opt.name, price: parseFloat(opt.price || 0), qty });
//     }
//     custom.render();
// });

// // Lista de decoraciones agregadas
// const $listWrap = $(`
//     <div class="col-span-1 md:col-span-2">
//         <div id="decorScroll"
//             class="mt-4 max-h-[40vh] lg:max-h-[40vh] overflow-y-auto overscroll-contain pr-2">
//         <div id="decorList" class="space-y-3"></div>
//         </div>
//     </div>
// `);

// function renderDecorList() {
//     const $list = $listWrap.find("#decorList").empty();
//     if (!items.length) {
//         $list.append(`
//         <div class="text-sm text-gray-400 border border-dashed border-gray-700 rounded p-3 text-center">
//             No hay decoraciones agregadas.
//         </div>
//     `);
//         return;
//     }
//     items.forEach((it, i) => {
//         const lineTotal = (parseFloat(it.price || 0) * (it.qty || 1));
//         const $row = $(`
//         <div class="flex items-center justify-between gap-3 bg-gray-900/50 border border-gray-700 rounded-lg p-3">
//             <div class="flex-1">
//                 <div class="text-gray-200 font-medium">${it.name}</div>
//                 <div class="text-xs text-gray-400">Precio unitario: ${this.formatPrice(it.price)}</div>
//             </div>
//             <div class="flex items-center gap-2">
//                 <button class="btn-minus border border-gray-700 rounded px-2 py-1 hover:bg-gray-700">−</button>
//                 <input type="text" class="qty-input w-12 text-center border border-gray-700 bg-gray-800 text-gray-200 rounded px-2 py-1" value="${it.qty || 1}" />
//                 <button class="btn-plus border border-gray-700 rounded px-2 py-1 hover:bg-gray-700">+</button>
//             </div>
//             <div class="w-28 text-right font-semibold text-emerald-400">${this.formatPrice(lineTotal)}</div>
//             <button class="btn-remove text-gray-400 hover:text-red-400" title="Quitar"><i class="icon-trash text-red-400 hover:text-red-500"></i></button>
//         </div>
//     `);
//         $row.find(".btn-minus").on("click", () => {
//             items[i].qty = Math.max(1, (items[i].qty || 1) - 1);
//             custom.render();
//         });
//         $row.find(".btn-plus").on("click", () => {
//             items[i].qty = (items[i].qty || 1) + 1;
//             custom.render();
//         });
//         $row.find(".qty-input").on("input", function () {
//             let v = parseInt($(this).val() || "0", 10);
//             if (Number.isNaN(v) || v < 1) v = 1;
//             items[i].qty = v;
//             custom.render();
//         });
//         $row.find(".btn-remove").on("click", () => {
//             items.splice(i, 1);
//             custom.render();
//         });
//         $list.prepend($row);
//     });
// }

// $opcionesPaso.append($uiWrap);
// $opcionesPaso.append($listWrap);
// renderDecorList();
async function armarPastel() {
    let data = await useFetch({ url: "ctrl/ctrl-pedidos.php", data: { opc: 'getModifiers' } });

    const html = `
        <div id="pastelModalRoot" class="w-full">
        <main class="max-w-6xl mx-auto px-6 py-6 space-y-10">
            <section class="text-center space-y-4">
                <h2 class="text-4xl font-bold text-violet-300">
                    ¡Bienvenido a tu experiencia de repostería!✨
                </h2>
                <p class="text-lg text-gray-300 max-w-2xl mx-auto">
                    Personaliza cada detalle para hacer algo único y delicioso.
                </p>
            </section>

            <section class="bg-gray-800 rounded-xl p-6 shadow border border-gray-700 space-y-4">
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

                <div class="flex justify-between text-sm text-gray-500 font-medium" id="stepButtons">
                </div>
            </section>

            <section class="grid lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 space-y-6">
                    <div class="flex justify-end items-center">
                        <div class="flex gap-2">
                            <button id="btnAnterior" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700">Anterior</button>
                            <button id="btnSiguiente" class="border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30">Siguiente</button>
                        </div>
                    </div>

                    <div class="bg-gray-800 border-2 border-violet-700/30 rounded-xl p-4 space-y-2 shadow">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <!-- Emoji y título en una sola fila -->
                                <div class="flex items-center gap-2">
                                    <span class="text-3xl">🔷</span>
                                    <p id="tituloPaso" class="text-lg font-bold text-violet-300">Paso 1: Formas</p>
                                </div>
                                <!-- Subtítulo -->
                                <p class="text-gray-400 text-sm">Dale forma a tu creatividad. ¡Elige tu diseño!</p>
                            </div>
                            <div>
                                <button id="btnAgregarOpcion" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-violet-700/30">+ Opción</button>
                            </div>
                        </div>
                        <div id="opcionesPaso" class="grid md:grid-cols-2 gap-4 pt-3"></div>
                    </div>

                </div>

                <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-2 shadow text-center">
                    <h3 class="text-violet-300 text-lg font-semibold flex items-center gap-1 justify-center">
                    💜 Tu Pastel
                    </h3>
                    <div class="text-5xl animate-bounce">🎂</div>
                    <p class="text-gray-400 text-sm font-medium">Precio sugerido: <span id="precioSugerido" class="text-violet-300">$200</span></p>
                    <div id="preview" class="text-sm text-violet-300 space-y-1"></div>
                    <div class="flex justify-start flex-col">
                        <label for="porciones" class="text-start text-sm text-gray-400">Porciones:</label>
                        <input type="text" id="porciones" class="border border-gray-700 bg-gray-800 text-gray-200 rounded px-4 py-2 mt-2 w-full" placeholder="Porciones" oninput="calculateSuggestedPrice(this)">
                        <label for="precioReal" class="text-start text-sm text-gray-400">Precio real:</label>
                        <div class="flex items-center border border-gray-700 bg-gray-800 text-gray-200 rounded mt-2 w-full">
                            <span class="px-3 text-gray-400">$</span>
                            <input type="text" 
                                    id="precioReal" 
                                    class="flex-1 bg-transparent outline-none py-2" 
                                    placeholder="Precio real" 
                                    oninput="formatCifra(this)">
                        </div>
                    </div>
                </div>
            </section>
        </main>
        <div class="flex justify-end mt-3 px-6 pb-6">
            <button id="btnCancelar" class="border border-gray-700 px-4 py-1 rounded-full text-sm text-gray-400 hover:bg-gray-700 me-2" onclick="bootbox.hideAll()">Cancelar</button>
            <button id="btnGuardar" class="border border-violet-500 px-4 py-1 rounded-full text-sm text-violet-300 hover:bg-violet-700/30">Guardar</button>
        </div>
        </div>
    `;

    const $modal = bootbox.dialog({
        title: `🎂 ¡Arma tu pastel!`,
        size: "extra-large",
        id: "modalArmarPastel",
        closeButton: true,
        message: html,
    });

    $modal.on("shown.bs.modal", function () {
        const $root = $("#modalArmarPastel");
        let categories = data.data || [];

        let currentStep = 0;
        let selectedOptions = {};

        const $progresoTexto = $root.find("#progresoTexto");
        const $progresoBadge = $root.find("#progresoBadge");
        const $barraProgreso = $root.find("#barraProgreso");
        const $tituloPaso = $root.find("#tituloPaso");
        const $opcionesPaso = $root.find("#opcionesPaso");
        const $preview = $root.find("#preview");
        const $btnAnterior = $root.find("#btnAnterior");
        const $btnSiguiente = $root.find("#btnSiguiente");
        const $stepButtons = $root.find("#stepButtons").empty();
        const $btnGuardar = $root.find("#btnGuardar");
        const $btnAgregarOpcion = $root.find("#btnAgregarOpcion");

        // Agregar opción para cada categoría
        $btnAgregarOpcion.on("click", function () {
            const cat = categories[currentStep];
            if (!cat) return;
            bootbox.prompt({
                title: `Agregar nueva opción a "${cat.name}"`,
                inputType: 'text',
                placeholder: 'Nombre de la opción',
                callback: function (result) {
                    if (result) {
                        const newId = Date.now(); // ID temporal único
                        const newOption = { id: newId, name: result, price: 0 };
                        cat.options = cat.options || [];
                        cat.options.push(newOption);
                        render(); // refresca todo
                    }
                }
            });
        });

        // Helper para detectar categoría multi (Decoraciones)
        function isMultiCategory(cat) {
            return !!(cat && (cat.isExtra == 1 || /decoraci/i.test(cat.name || "")));
        }

        // (Opcional) resalta visualmente los pasos incompletos
        function markIncompleteSteps(missingIds = []) {
            const set = new Set(missingIds);
            $root.find(".step-button").each(function (index) {
                const cat = categories[index];
                const $btn = $(this);
                if (cat && set.has(cat.id)) {
                    $btn.addClass("ring-2 ring-red-500");
                } else {
                    $btn.removeClass("ring-2 ring-red-500");
                }
            });
        }


        // steps buttons
        categories.forEach((cat, index) => {
            const $btn = $(`
              <button class="step-button flex flex-col items-center min-w-[80px] gap-1 p-2 rounded-lg text-xs ${index === 0 ? "bg-violet-700/30 text-violet-300" : "text-gray-500 hover:text-violet-300"}">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-violet-500 text-white" : "bg-gray-700"}">${index + 1}</div>
                <span class="hidden sm:block">${cat.name}</span>
              </button>
            `);
            $btn.on("click", function () {
                currentStep = index;
                render();
            });
            $stepButtons.append($btn);
        });

        function renderProgress() {
            let completados = 0;

            categories.forEach(cat => {
                const sel = selectedOptions[cat.id];
                const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");
                const done = isMulti ? (Array.isArray(sel) && sel.length > 0) : !!sel;

                if (done) completados++;
            });

            const porcentaje = (completados / categories.length) * 100;
            $barraProgreso.css("width", porcentaje + "%");
            $progresoBadge.text(`${completados} / ${categories.length}`);
            $progresoTexto.text(
                completados === categories.length
                    ? "¡Tu pastel está listo! 🎉"
                    : `${completados} de ${categories.length} pasos completados`
            );
        }

        function renderOptions() {
            const cat = categories[currentStep];
            if (!cat) return;

            const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");
            $tituloPaso.text(`Paso ${currentStep + 1}: ${cat.name}`);
            $opcionesPaso.empty();

            if (isMulti) {
                // Asegura arreglo temporal
                if (!Array.isArray(selectedOptions[cat.id])) selectedOptions[cat.id] = [];
                const items = selectedOptions[cat.id];

                // === WRAPPER 1: UI (select + cantidad + botón) ===
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
                            <input id="decorQty" type="number" min="1" value="1"
                                class="w-24 border border-gray-700 bg-gray-800 text-gray-200 rounded px-3 py-2 text-right"/>
                        </div>
                        <div>
                            <label class="block text-xs text-transparent mb-1">.</label>
                            <button id="btnAddDecor"
                                    class="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-700 text-white">
                            + Agregar
                            </button>
                        </div>
                        </div>
                    </div>
                `);

                // === WRAPPER 2: LISTA (ocupa fila completa) ===
                const $listWrap = $(`
                    <div class="col-span-1 md:col-span-2">
                        <!-- Contenedor con scroll en Y -->
                        <div id="decorScroll"
                            class="mt-4 max-h-[40vh] lg:max-h-[40vh] overflow-y-auto overscroll-contain pr-2">
                        <div id="decorList" class="space-y-3"></div>
                        </div>
                    </div>
                `);


                // Handlers UI
                $uiWrap.find("#btnAddDecor").on("click", () => {
                    const idSel = String($uiWrap.find("#decorSelect").val());
                    const qty = Math.max(1, parseInt($uiWrap.find("#decorQty").val() || "1", 10));
                    const opt = (cat.options || []).find(o => String(o.id) === idSel);
                    if (!opt) return;

                    const idx = items.findIndex(it => String(it.id) === idSel);
                    if (idx >= 0) {
                        items[idx].qty = (items[idx].qty || 1) + qty; // acumula
                    } else {
                        items.push({ id: opt.id, name: opt.name, price: parseFloat(opt.price || 0), qty });
                    }
                    render(); // refresca todo (lista, preview, progreso, total)
                });

                // Render de la lista
                function renderDecorList() {
                    const $list = $listWrap.find("#decorList").empty();

                    if (!items.length) {
                        $list.append(`
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
                            render();
                        });
                        $row.find(".btn-plus").on("click", () => {
                            items[i].qty = (items[i].qty || 1) + 1;
                            render();
                        });
                        $row.find(".qty-input").on("input", function () {
                            let v = parseInt($(this).val() || "0", 10);
                            if (Number.isNaN(v) || v < 1) v = 1;
                            items[i].qty = v;
                            render();
                        });
                        $row.find(".btn-remove").on("click", () => {
                            items.splice(i, 1);
                            render();
                        });

                        $list.prepend($row);
                    });
                }

                // Monta en el grid como hermanos (no comparten contenedor)
                $opcionesPaso.append($uiWrap);
                $opcionesPaso.append($listWrap);
                renderDecorList();

            } else {
                // ... tu lógica de selección única para otras categorías (sin cambios) ...
                const selected = selectedOptions[cat.id];
                (cat.options || []).forEach((opt) => {
                    const isSelected = selected && selected.id === opt.id;
                    const $btn = $(`
                        <button
                        class="group border border-gray-700 px-4 py-2 rounded-lg w-full transition-all duration-300
                                flex items-center justify-between gap-3
                                ${isSelected
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold scale-105 border-transparent"
                            : "hover:bg-gray-700 text-gray-200"}"
                        type="button">
                        <span class="truncate">${opt.name}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full
                                    ${isSelected ? "bg-white/20 text-white" : "bg-gray-700 text-gray-300"}">
                            ${formatPrice(opt.price)}
                        </span>
                        </button>
                    `);

                    $btn.on("click", function () {
                        if (selectedOptions[cat.id] && selectedOptions[cat.id].id === opt.id) {
                            selectedOptions[cat.id] = null;
                        } else {
                            selectedOptions[cat.id] = { id: opt.id, name: opt.name, price: parseFloat(opt.price || 0) };
                        }
                        render();
                    });

                    $opcionesPaso.append($btn);
                });
            }
        }

        function renderPreview() {
            $preview.empty();
            let total = 0;

            categories.forEach(cat => {
                const sel = selectedOptions[cat.id];
                if (!sel) return;

                const isMulti = cat.isExtra == 1 || /decoraci/i.test(cat.name || "");

                if (isMulti) {
                    const items = Array.isArray(sel) ? sel : [];
                    if (!items.length) return;

                    $preview.append(`<div class="text-sm font-semibold text-violet-300 mt-3">${cat.name}</div>`);

                    items.forEach(it => {
                        const lineTotal = parseFloat(it.price || 0) * (it.qty || 1);
                        total += lineTotal;

                        $preview.append(`
                            <div class="flex justify-between items-center border-t border-gray-700 py-1 text-sm">
                                <span class="text-gray-200"><span class="text-violet-300">x${it.qty || 1}</span> ${it.name}</span>
                                <span class="text-violet-400 font-semibold">${formatPrice(lineTotal)}</span>
                            </div>
                        `);
                    });
                } else {
                    const lineTotal = parseFloat(sel.price || 0);
                    total += lineTotal;
                    $preview.append(`
                        <div class="grid grid-cols-3 items-center border-t border-gray-700 py-1 text-sm">
                            <span class="font-medium text-violet-300 justify-self-start">${cat.name}:</span>
                            <span class="text-gray-200 justify-self-start">${sel.name}</span>
                            <span class="text-violet-400 font-semibold justify-self-end">${formatPrice(lineTotal)}</span>
                        </div>
                    `);
                }
            });

            if (total > 0) {
                let numeroPorciones = parseFloat($root.find("#porciones").val()) || 1;
                let totalSugerido = total * numeroPorciones;
                $preview.append(`
                    <div class="flex justify-between items-center border-t border-violet-700 mt-2 pt-2 font-bold text-violet-300">
                        <span>Total:</span>
                        <span>${formatPrice(total)}</span>
                    </div>
                `);
                $root.find("#precioSugerido").text(formatPrice(totalSugerido));
            }
        }

        function renderNavigation() {
            $btnAnterior.prop("disabled", currentStep === 0);
            $btnSiguiente.prop("disabled", currentStep === categories.length - 1);
        }

        function actualizarEstilosPasos() {
            const $stepButtons = $root.find(".step-button");

            $stepButtons.each(function (index) {
                const $btn = $(this);
                const $circle = $btn.find("div").first();
                const cat = categories[index];
                const sel = cat ? selectedOptions[cat.id] : null;

                // Detecta multi por flag o por nombre
                const isMulti = !!(cat && (cat.isExtra == 1 || /decoraci/i.test(cat.name || "")));
                const done = isMulti ? (Array.isArray(sel) && sel.length > 0) : !!sel;

                if (index === currentStep) {
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

        function render() {
            renderProgress();
            renderOptions();
            renderPreview();
            renderNavigation();
            actualizarEstilosPasos();
        }

        $btnAnterior.on("click", function () {
            if (currentStep > 0) currentStep--;
            render();
        });

        $btnSiguiente.on("click", function () {
            if (currentStep < categories.length - 1) currentStep++;
            render();
        });

        $root.find(".step-button").each(function (index) {
            $(this).on("click", function () {
                currentStep = index;
                render();
            });
        });

        function handleSave() {
            const missingCats = [];
            const payload = [];  // lo que enviarías al backend
            let total = 0;

            categories.forEach(cat => {
                const sel = selectedOptions[cat.id];
                const multi = isMultiCategory(cat);

                if (multi) {
                    const items = Array.isArray(sel) ? sel.filter(it => it && (parseInt(it.qty, 10) >= 1)) : [];
                    if (items.length === 0) {
                        missingCats.push({ id: cat.id, name: cat.name });
                    } else {
                        // Totaliza y arma payload
                        const mapItems = items.map(it => {
                            const qty = parseInt(it.qty, 10) || 1;
                            const price = parseFloat(it.price || 0);
                            total += (price * qty);
                            return { id: it.id, name: it.name, price, qty };
                        });
                        payload.push({ categoryId: cat.id, category: cat.name, items: mapItems });
                    }
                } else {
                    if (!sel || sel.id == null) {
                        missingCats.push({ id: cat.id, name: cat.name });
                    } else {
                        const price = parseFloat(sel.price || 0);
                        total += price;
                        payload.push({ categoryId: cat.id, category: cat.name, item: { id: sel.id, name: sel.name, price } });
                    }
                }
            });

            // (Opcional) validar precioReal si lo quieres obligatorio numérico
            // const precioRealStr = $root.find("#precioReal").val().trim();
            // if (precioRealStr === "" || isNaN(parseFloat(precioRealStr))) {
            //   bootbox.alert("Por favor, captura un 'Precio real' válido.");
            //   return false;
            // }

            if (missingCats.length > 0) {
                // Marca pasos incompletos y alerta
                markIncompleteSteps(missingCats.map(m => m.id));

                const lista = missingCats.map(m => `• ${m.name}`).join("<br>");
                bootbox.alert({
                    title: "Faltan campos por completar",
                    message: `Por favor completa las siguientes categorías antes de guardar:<br><br>${lista}`
                });
                return false; // ❗ evita que se cierre el modal
            }

            // Limpia marcas de error si todo OK
            markIncompleteSteps([]);

            // Si quieres ver el payload y total:
            console.log("Payload listo para backend:", payload);
            console.log("Total sugerido:", total);

            // (Opcional) aquí puedes hacer tu POST al backend con 'payload' y 'total'
        }

        $btnGuardar.on("click", function (e) {
            handleSave();
        });

        render();
    });
}

function formatCifra(input) {
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


function calculateSuggestedPrice(inputPorciones) {
    const $root = $("#modalArmarPastel");
    if ($root.length === 0) return; // No hacer nada si el modal no está abierto

    // 👉 Primero normaliza/limpia el input con tu función existente
    formatCifra(inputPorciones);

    let total = 0;

    // Sumar todos los subtotales
    $root.find("#preview .text-violet-400").each(function () {
        const text = $(this).text().replace(/[^0-9.-]+/g, "");
        const num = parseFloat(text);
        if (!isNaN(num)) {
            total += num;
        }
    });

    // Ahora obtener porciones (ya limpias por formatCifra)
    let porcionesVal = $(inputPorciones).val().replace(/,/g, "");
    let numeroPorciones = parseFloat(porcionesVal) || 1;

    // Calcular sugerido
    let totalSugerido = total * numeroPorciones;
    $root.find("#precioSugerido").text(formatPrice(totalSugerido));
}
