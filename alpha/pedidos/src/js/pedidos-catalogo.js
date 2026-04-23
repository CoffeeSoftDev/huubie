class Pos extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "";
    }

    // Components.
    createPOSContainers(options) {
        const opts = Object.assign({
            parent: "container-package",
            id: "posLayout",
            theme: "dark",
            class: "flex flex-col md:flex-row text-sm text-white h-full",
            onChange: (item) => { },
            onBuildCake: () => {
                custom.render();
            }
        }, options);

        const isDark = opts.theme === "dark";

        const colors = {
            containerBg: isDark ? "" : "bg-white",
            textColor: isDark ? "text-white" : "text-gray-600",
            leftPaneBg: isDark ? "bg-[#1F2A37]" : "bg-gray-100",
            inputBg: isDark ? "bg-[#111827]" : "bg-white",
            borderColor: isDark ? "border-gray-700" : "border-gray-300",
            cardGridBg: isDark ? "" : "bg-white",
            tabBg: isDark ? "bg-[#151D2B]" : "bg-gray-100"
        };

        const container = $("<div>", {
            id: opts.id,
            class: `${opts.class} ${colors.containerBg} ${colors.textColor}`
        });

        const leftPane = $("<div>", {
            class: `flex-1 flex flex-col overflow-hidden ${colors.leftPaneBg} ${colors.borderColor}`
        });

        const mainContent = $("<div>", {
            class: "flex-1 flex flex-col overflow-hidden px-4 py-3"
        });

        const topRow = $("<div>", {
            class: "flex items-center justify-between gap-3 mb-3"
        });

        const searchInputWrap = $("<div>", {
            class: "relative flex-1 max-w-md"
        });

        const inputSearch = $("<input>", {
            id: "searchProduct",
            type: "text",
            placeholder: "Buscar productos...",
            class: `pl-10 py-2 pr-3 rounded-md border ${colors.borderColor} ${colors.inputBg} ${colors.textColor} w-full focus:outline-none focus:ring-2 focus:ring-blue-500`
        }).on("input", function () {
            const keyword = $(this).val().toLowerCase();
            opts.onChange(keyword);
        });

        const searchIcon = $("<i>", {
            class: `icon-search absolute left-3 top-2.5 ${isDark ? "text-gray-400" : "text-gray-500"}`
        });

        searchInputWrap.append(inputSearch, searchIcon);

        const buildCakeBtn = $("<button>", {
            id: "buildCakeBtn",
            class: "bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md whitespace-nowrap transition-colors duration-200",
            html: "¡Arma tu pastel! 🎂",
            click: () => opts.onBuildCake()
        });

        topRow.append(searchInputWrap, buildCakeBtn);

        const categoryWrapper = $("<div>", {
            class: "relative flex items-center gap-1 mb-3"
        });

        const scrollLeftBtn = $("<button>", {
            id: "scrollCategoryLeft",
            class: `${isDark ? 'bg-[#374151] hover:bg-[#4B5563]' : 'bg-gray-200 hover:bg-gray-300'} ${colors.textColor} w-9 h-9 rounded-full transition-colors duration-200 flex-shrink-0 flex items-center justify-center text-base hidden`,
            html: '<i class="icon-left-open"></i>',
            click: () => {
                const tabsContainer = $('#categoryTabs');
                tabsContainer.animate({
                    scrollLeft: tabsContainer.scrollLeft() - 200
                }, 300, () => this.updateScrollButtons());
            }
        });

        const categoryTabs = $("<div>", {
            id: "categoryTabs",
            class: `${colors.textColor} flex-1 overflow-x-auto scrollbar-hide`
        }).on("scroll", () => this.updateScrollButtons());

        new ResizeObserver(() => this.updateScrollButtons()).observe(categoryTabs[0]);

        const scrollRightBtn = $("<button>", {
            id: "scrollCategoryRight",
            class: `${isDark ? 'bg-[#374151] hover:bg-[#4B5563]' : 'bg-gray-200 hover:bg-gray-300'} ${colors.textColor} w-9 h-9 rounded-full transition-colors duration-200 flex-shrink-0 flex items-center justify-center text-base hidden`,
            html: '<i class="icon-right-open"></i>',
            click: () => {
                const tabsContainer = $('#categoryTabs');
                tabsContainer.animate({
                    scrollLeft: tabsContainer.scrollLeft() + 200
                }, 300, () => this.updateScrollButtons());
            }
        });

        categoryWrapper.append(scrollLeftBtn, categoryTabs, scrollRightBtn);

        const productGridContainer = $("<div>", {
            class: "flex-1 overflow-auto"
        });

        const grid = $("<div>", {
            id: "productGrid",
            class: `grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 rounded ${colors.cardGridBg}`
        });

        const showMoreBtn = $("<button>", {
            id: "showMoreProducts",
            class: `w-full mt-3 py-2 rounded-md border ${colors.borderColor} ${isDark ? 'bg-[#374151] hover:bg-[#4B5563]' : 'bg-gray-100 hover:bg-gray-200'} ${colors.textColor} font-medium transition-colors duration-200 hidden`,
            html: '<i class="icon-down-open"></i> Ver más productos',
            click: function() {
                const gridEl = $('#productGrid');
                gridEl.toggleClass('max-h-[400px]');
                const isExpanded = !gridEl.hasClass('max-h-[400px]');
                $(this).html(isExpanded ? '<i class="icon-up-open"></i> Ver menos' : '<i class="icon-down-open"></i> Ver más productos');
            }
        });

        productGridContainer.append(grid, showMoreBtn);

        mainContent.append(topRow, categoryWrapper, productGridContainer);
        leftPane.append(mainContent);

        const rightPane = $("<div>", {
            id: "orderPanel",
            class: `w-full md:w-[25rem] max-w-full flex flex-col border-l ${colors.leftPaneBg} ${colors.borderColor}`
        });

        container.append(leftPane, rightPane);
        $(`#${opts.parent}`).html(container);
    }

    updateScrollButtons() {
        const tabs = document.getElementById('categoryTabs');
        if (!tabs) return;
        const scrollLeft = tabs.scrollLeft;
        const maxScroll = tabs.scrollWidth - tabs.clientWidth;
        const needsScroll = tabs.scrollWidth > tabs.clientWidth;

        $('#scrollCategoryLeft').toggleClass('hidden', !needsScroll || scrollLeft <= 0);
        $('#scrollCategoryRight').toggleClass('hidden', !needsScroll || scrollLeft >= maxScroll - 1);
    }

    createProductTabs(options) {
        const opts = Object.assign({
            parent: "categoryTabs",
            data: [
                { text: "Chocolate", id: "chocolate", icon: "icon-cake" },
                { text: "Frutas", id: "frutas", emoji: "🍓" },
                { text: "Queso", id: "queso" },
                { text: "Merengue", id: "merengue" },
                { text: "Todos", id: "todos" }
            ],
            active: null, // Si es null, se activa el primero
            activeColor: "bg-blue-600",
            inactiveColor: "", // auto-definido por tema
            hoverColor: "",
            theme: "dark",
            onChange: (category) => { }
        }, options);

        const isDark = opts.theme === "dark";
        const activeClass = opts.activeColor;
        const inactiveClass = opts.inactiveColor || "bg-[#283143]";
        const inactiveBorder = isDark ? "borderx border-gray-600x" : "borderx border-gray-300x";
        const hoverClass = opts.hoverColor || (isDark ? "hover:bg-white/10" : "hover:bg-gray-300");
        const textColor = isDark ? "text-white" : "text-gray-800";
        const containerBorder = isDark ? "border-gray-600x" : "border-gray-300x";
        const containerBg = isDark ? "xbg-[#151D2B]" : "bg-gray-100";

        const container = $(`#${opts.parent}`).empty().addClass(`flex gap-1 flex-nowrap w-max px-1.5 py-1 rounded-lg borderx ${containerBorder} ${containerBg}`);

        // Aseguramos que siempre haya uno activo
        const defaultActiveId = opts.active ?? (opts.data.length > 0 ? opts.data[0].id : null);

        opts.data.forEach((cat, index) => {
            const isActive = cat.id === defaultActiveId;

            // Icono o emoji opcional
            let iconHtml = "";
            if (cat.icon) iconHtml = `<i class="${cat.icon}"></i>`;
            else if (cat.emoji) iconHtml = `<span>${cat.emoji}</span>`;

            const formattedText = cat.text.charAt(0).toUpperCase() + cat.text.slice(1).toLowerCase();

            const btn = $("<button>", {
                class: `tab-btn ${textColor} flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${isActive ? `${activeClass} border border-transparent` : `${inactiveClass} ${inactiveBorder} ${hoverClass}`}`,
                html: `${iconHtml}<span>${formattedText}</span>`,
                "data-category": cat.id,
                click: function () {
                    container.find(".tab-btn").each(function () {
                        $(this)
                            .removeClass(`${activeClass} border-transparent`)
                            .addClass(`${inactiveClass} ${inactiveBorder} ${hoverClass}`);
                    });

                    $(this)
                        .removeClass(`${inactiveClass} ${inactiveBorder} ${hoverClass}`)
                        .addClass(`${activeClass} border border-transparent`);

                    // Callback general
                    opts.onChange(cat.id);

                    // Callback individual si existe
                    if (typeof cat.onClick === "function") {
                        cat.onClick(cat.id);
                    }
                }
            });

            container.append(btn);
        });

        setTimeout(() => this.updateScrollButtons(), 50);
    }

    createProductGrid(options) {
        const defaults = {
            parent: "productGrid",
            data: [],
            theme: "dark",
            icon: "icon-star",
            onClick: (item) => { }
        };

        const opts = Object.assign(defaults, options);

        const isDark = opts.theme === "dark";
        const cardBg = isDark ? "bg-[#111827]" : "bg-white";
        const borderColor = isDark ? "border-gray-700" : "border-gray-300";
        const textColor = isDark ? "text-white" : "text-gray-800";
        const priceColor = isDark ? "text-blue-300" : "text-blue-600";
        const buttonColor = "bg-blue-600 hover:bg-blue-700";

        const container = $(`#${opts.parent}`).empty();
        const baseUrl = "https://huubie.com.mx/";

        opts.data.forEach(item => {
            const card = $("<div>", {
                class: `${cardBg} border ${borderColor} rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 card`,
                click: () => opts.onClick(item)
            });

            const imageWrap = $("<div>", {
                class: "bg-gray-800 h-28 flex items-center justify-center"
            });

            if (item.image && item.image.trim() !== "") {
                imageWrap.append(
                    $("<img>", {
                        src: baseUrl + item.image,
                        alt: item.name,
                        class: "object-cover h-full w-full"
                    })
                );
            } else {
                imageWrap.append(
                    $("<i>", {
                        class: `${item.icon || opts.icon} text-3xl text-gray-500`
                    })
                );
            }

            const body = $("<div>", { class: "p-2" }).append(
                $("<h3>", {
                    class: `${textColor} text-sm font-medium truncate`,
                    text: item.name ?? item.valor
                }),
                $("<p>", {
                    class: `${priceColor} font-semibold text-sm mt-1`,
                    text: `${formatPrice(item.price)}`
                }),
                $("<div>", { class: "text-right mt-1" }).append(
                    $("<button>", {
                        class: `inline-block ${buttonColor} text-white rounded px-2 py-1 text-xs`,
                        html: `<i class="icon-eye"></i>`,
                        click: (e) => {
                            e.stopPropagation();
                            this.showProductDetails(item.id);
                        }
                    })
                )
            );

            card.append(imageWrap, body);
            container.append(card);
        });
    }

    createOrderPanel(options) {
        const opts = Object.assign({
            parent: "orderPanel", // ID donde se monta
            title: "Orden Actual",
            onClear: () => {
                // lógica externa que puedes conectar
            }
        }, options);

        const container = $(`#${opts.parent}`).empty();

        // 🧾 Header
        const header = $("<div>", {
            class: "p-4 border-b border-gray-700 flex justify-between items-center"
        }).append(
            $("<h2>", {
                class: "text-lg font-semibold text-white",
                text: opts.title
            }),
            $("<button>", {
                class: "text-red-400 border border-[#C53030] px-2 py-1 rounded hover:bg-red-700",
                html: "🗑 Limpiar",
                click: opts.onClear
            })
        );

        // 📦 Lista de productos agregados
        const orderItems = $("<div>", {
            id: "orderItems",
            class: "flex-1 overflow-auto p-3 space-y-3"
        });

        // 💰 Totales
        const totals = $("<div>", {
            class: "p-4 border-t border-gray-700 bg-[#333D4C]"
        }).append(
            $("<div>", { class: "space-y-1 text-sm text-gray-300" }).append(
                // $("<div>", { class: "flex justify-between" }).append(
                //     $("<span>").text("Subtotal:"),
                //     $("<span>", { id: "subtotal", text: "$0.00" })
                // ),
                // $("<div>", { class: "flex justify-between" }).append(
                //     $("<span>").text("IVA (16%):"),
                //     $("<span>", { id: "tax", text: "$0.00" })
                // ),
                // $("<div>", { class: "border-t my-2 border-gray-700" }),
                $("<div>", { class: "flex justify-between font-bold text-blue-400" }).append(
                    $("<span>").text("Total:"),
                    $("<span>", { id: "total", text: "$0.00" })
                )
            ),
            $("<div>", { class: "grid grid-cols-3 gap-2 mt-4" }).append(
                $("<button>", {
                    class: "border border-gray-600 text-white rounded px-3 py-2 text-sm",
                    html: "🖨 Imprimir"
                }),

                $("<button>", {
                    id: 'finishOrder',
                    class: "bg-blue-700 text-white rounded px-3 py-2 text-sm hover:bg-blue-800",
                    html: "Terminar"
                }),

                $("<button>", {
                    id: "exitOrder",
                    class: "border border-red-600 text-red-400 rounded px-3 py-2 text-sm hover:bg-red-700 hover:text-white",
                    html: "Salir!!!"
                }),
            )
        );

        $(document).off("click", "#printOrder").on("click", "#printOrder", () => {
            if (typeof opts.onPrint === "function") opts.onPrint(opts.data);
        });

        $(document).off("click", "#exitOrder").on("click", "#exitOrder", () => {
            app.render();
        });

        $(document).off("click", "#finishOrder").on("click", "#finishOrder", () => {
            if (typeof opts.onFinish === "function") opts.onFinish(opts.data);
        });

        // 🧩 Ensamblar
        container.append(header, orderItems, totals);
    }

    renderOrderPanel(options) {
        const defaults = {
            parent: "orderPanel",
            title: "Orden Actual",
            data: [],
            theme: "dark",
            totalSelector: "#total",
            onClear: () => { },
            onQuanty: (id, action, newQuantity) => { },
            onEdit: (id) => { },
            onRemove: (id) => { },
            onCleared: () => { },
            onPrint: () => { },
            onExit: () => { },
            onFinish: () => { }
        };

        const opts = Object.assign({}, defaults, options);

        const isDark = opts.theme === "dark";
        const textColor = isDark ? "text-white" : "text-gray-800";
        const subColor = isDark ? "text-blue-300" : "text-blue-600";
        const borderColor = isDark ? "border-gray-700" : "border-gray-300";
        const bgCard = isDark ? "bg-[#1E293B]" : "bg-white";
        const mutedColor = isDark ? "text-gray-300" : "text-gray-600";

        const container = $(`#${opts.parent}`).empty();

        // Header
        const header = $("<div>", {
            class: "p-4 border-b border-gray-700 flex justify-between items-center"
        }).append(
            $("<h2>", {
                class: "text-lg font-semibold text-white",
                text: opts.title
            }),
            $("<button>", {
                id: "clearOrder",
                class: "text-red-400 border border-[#C53030] px-2 py-1 rounded hover:bg-red-700",
                html: "🗑 Limpiar",
                click: opts.onClear
            })
        );

        // Contenedor dinámico
        const orderItems = $("<div>", {
            id: "orderItems",
            class: "flex-1 overflow-auto p-3 space-y-3"
        });

        // Footer
        const footer = $("<div>", {
            class: "p-4 border-t border-gray-700 bg-[#333D4C]"
        }).append(
            $("<div>", { class: "space-y-1 text-sm text-gray-300" }).append(
                $("<div>", {
                    class: "flex justify-between font-bold text-blue-400"
                }).append(
                    $("<span>").text("Total:"),
                    $("<span>", { id: "total", text: "$0.00" })
                )
            ),
            $("<div>", { class: "grid grid-cols-3 gap-2 mt-4" }).append(
                $("<button>", {
                    id: "printOrder",
                    class: "border border-gray-600 text-white rounded px-3 py-2 text-sm",
                    html: "🖨 Imprimir"
                }),
                $("<button>", {
                    id: "finishOrder",
                    class: "bg-blue-700 text-white rounded px-3 py-2 text-sm hover:bg-blue-800",
                    html: "Terminar"
                }),
                $("<button>", {
                    id: "exitOrder",
                    class: "border border-red-600 text-red-400 rounded px-3 py-2 text-sm hover:bg-red-700 hover:text-white",
                    html: "Salir"
                }),

            )
        );

        // Ensamblar panel
        container.append(header, orderItems, footer);

        // Render productos
        const data = [...opts.data];
        let totalAcc = 0;

        data.forEach((item, index) => {
            const card = $("<div>", {
                class: `flex justify-between items-center ${bgCard} border ${borderColor} rounded-xl p-3 shadow-sm`
            });

            const info = $("<div>", { class: "flex-1" }).append(
                $("<p>", { class: `${textColor} font-medium text-sm`, text: item.name }),
                $("<p>", { class: `${subColor} font-semibold text-sm`, text: formatPrice(item.price) })
            );

            const actions = $("<div>", { class: "flex flex-col items-end gap-2" });
            const quantityRow = $("<div>", { class: "flex items-center gap-2" });

            console.log('olaaaaa',item);
            quantityRow.append(
                $("<button>", {
                    class: "bg-gray-700 text-white rounded px-2",
                    html: "−",
                    click: () => {
                        if (item.quantity > 1) {
                            item.quantity--;
                            opts.onQuanty(item.id, 0, item.quantity);
                            opts.data = data;
                            this.renderOrderPanel(opts);
                        }
                    }
                }),
                $("<span>", { class: `${textColor}`, text: item.quantity }),
                $("<button>", {
                    class: "bg-gray-700 text-white rounded px-2",
                    html: "+",
                    click: () => {
                        item.quantity++;
                        opts.onQuanty(item.id, 2, item.quantity);
                        opts.data = data;
                        this.renderOrderPanel(opts);
                    }
                }),
                $("<button>", {
                    class: "text-blue-400 hover:text-blue-600",
                    html: `<i class="icon-pencil"></i>`,
                    click: () => opts.onEdit(item.id)
                }),
                $("<button>", {
                    class: "text-gray-400 hover:text-red-400",
                    html: `<i class="icon-trash"></i>`,
                    click: () => {
                        data.splice(index, 1);
                        opts.onRemove(item.id);
                        opts.data = data;
                        this.renderOrderPanel(opts);
                    }
                })
            );

            const lineTotal = (item.price || 0) * (item.quantity || 0);
            totalAcc += lineTotal;

            const totalEl = $("<p>", {
                class: `${mutedColor} text-sm`,
                text: `Total: ${formatPrice(lineTotal)}`
            });

            actions.append(quantityRow, totalEl);
            card.append(info, actions);
            orderItems.append(card);
        });

        if (opts.totalSelector) $(opts.totalSelector).text(formatPrice(totalAcc));

        // Eventos
        $(document).off("click", "#clearOrder").on("click", "#clearOrder", () => {
            opts.data = [];
            $(`#orderItems`).empty();
            this.renderOrderPanel(opts);
            if (typeof opts.onCleared === "function") opts.onCleared();
        });

        $(document).off("click", "#printOrder").on("click", "#printOrder", () => {
            if (typeof opts.onPrint === "function") opts.onPrint(opts.data);
        });

        $(document).off("click", "#exitOrder").on("click", "#exitOrder", () => {
            if (typeof opts.onExit === "function") opts.onExit();
        });

        $(document).off("click", "#finishOrder").on("click", "#finishOrder", () => {
            if (typeof opts.onFinish === "function") opts.onFinish(opts.data);
        });
    }

    renderCart(options) {

        const opts = Object.assign({
            parent: "orderItems",
            data: [],
            theme: "dark",
            totalSelector: "#total",
            onQuanty: (id, action, newQuantity) => { },
            onEdit: (id) => { },
            onRemove: (id) => { },
            onCleared: () => { }
        }, options);

        const isDark = opts.theme === "dark";
        const textColor = isDark ? "text-white" : "text-gray-800";
        const subColor = isDark ? "text-blue-300" : "text-blue-600";
        const borderColor = isDark ? "border-gray-700" : "border-gray-300";
        const bgCard = isDark ? "bg-[#1E293B]" : "bg-white";
        const mutedColor = isDark ? "text-gray-300" : "text-gray-600";
        const emptyTitle = isDark ? "text-gray-300" : "text-gray-700";
        const emptySub = isDark ? "text-gray-400" : "text-gray-500";

        const container = $(`#${opts.parent}`).empty();
        const data = [...opts.data];
        let totalAcc = 0;

        if (data.length === 0) {
            const empty = $("<div>", {
                class: "w-full h-full flex items-center justify-center"
            }).append(
                $("<div>", { class: "text-center" }).append(
                    $(`<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto mb-3" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#9CA3AF' : '#6B7280'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L21 6H6"></path>
                </svg>`),
                    $("<p>", { class: `text-base font-medium ${emptyTitle}`, text: "No hay productos en la orden" }),
                    $("<p>", { class: `text-sm mt-1 ${emptySub}`, text: "Selecciona productos del catálogo" })
                )
            );

            container.append(empty);
            if (opts.totalSelector) $(opts.totalSelector).text(formatPrice(0));

            $(document).off("click", "#clearOrder").on("click", "#clearOrder", () => {
                opts.data = [];
                this.renderCart(opts);
                if (typeof opts.onCleared === "function") opts.onCleared();
            });

            return;
        }

        data.forEach((item, index) => {
            const card = $("<div>", {
                class: `flex justify-between items-center ${bgCard} border ${borderColor} rounded-xl p-3 shadow-sm`
            });

            const info = $("<div>", { class: "flex-1 space-y-1" }).append(
                $("<p>", { class: `${textColor} font-medium text-sm`, text: item.name }),
                $("<p>", { class: `${subColor} font-semibold text-sm`, text: formatPrice(item.price) }),
                item.dedication ? $("<p>", { class: `${mutedColor} text-xs italic`, text: `Dedicatoria: ${item.dedication}` }) : null,
                item.order_details ? $("<p>", { class: `${mutedColor} text-xs`, text: `Observación: ${item.order_details}` }) : null
            );

            const actions = $("<div>", { class: "flex flex-col items-end gap-2" });
            const quantityRow = $("<div>", { class: "flex items-center gap-2" });

            quantityRow.append(
                $("<button>", {
                    class: "bg-gray-700 text-white rounded px-2",
                    html: "−",
                    click: () => {
                        if (item.quantity > 1) {
                            item.quantity--;
                            opts.onQuanty(item.id, 0, item.quantity);
                            opts.data = data;
                            this.renderCart(opts);
                        }
                    }
                }),
                $("<span>", { class: `${textColor}`, text: item.quantity }),
                $("<button>", {
                    class: "bg-gray-700 text-white rounded px-2",
                    html: "+",
                    click: () => {
                        item.quantity++;
                        opts.onQuanty(item.id, 2, item.quantity);
                        opts.data = data;
                        this.renderCart(opts);
                    }
                }),
                $("<button>", {
                    class: "text-blue-400 hover:text-blue-600",
                    html: `<i class="icon-pencil"></i>`,
                    click: (e) => {
                        e.stopPropagation();
                        if (typeof opts.onEdit === "function") opts.onEdit(item.id);
                    }
                }),
                $("<button>", {
                    class: "text-gray-400 hover:text-red-400",
                    html: `<i class="icon-trash"></i>`,
                    click: () => {
                        data.splice(index, 1);
                        opts.onRemove(item.id);
                        opts.data = data;
                        this.renderCart(opts);
                    }
                })
            );

            const lineTotal = (item.price || 0) * (item.quantity || 0);
            totalAcc += lineTotal;

            const totalEl = $("<p>", {
                class: `${mutedColor} text-sm`,
                text: `Total: ${formatPrice(lineTotal)}`
            });

            actions.append(quantityRow, totalEl);
            card.append(info, actions);
            container.append(card);
        });

        if (opts.totalSelector) $(opts.totalSelector).text(formatPrice(totalAcc));

        $(document).off("click", "#clearOrder").on("click", "#clearOrder", () => {
            opts.data = [];
            this.renderCart(opts);
            if (typeof opts.onCleared === "function") opts.onCleared();
        });
    }

    orderPanelComponent(options) {
        const defaults = {
            parent: "root",
            id: "orderPanel",
            title: "Orden Actual",
            data: [],
            theme: "dark",
            totalSelector: "#total",
            emptyTitle: "No hay productos en la orden",
            emptySub: "Selecciona productos del catálogo para continuar.",
            discount: 0,
            onClear: () => { },
            onQuanty: (id, action, newQuantity) => { },
            onEdit: (id) => { },
            onRemove: (id) => { },
            onCleared: () => { },
            onPrint: () => { },
            onExit: () => { },
            onFinish: () => { },
            onBuildCake: () => { armarPastel(); },
            payments: [],
            totalPaid: 0
        };

        
        const opts = Object.assign({}, defaults, options);
        console.log(opts.data)

        const isDark = opts.theme === "dark";
        const textColor = isDark ? "text-white" : "text-gray-800";
        const subColor = isDark ? "text-blue-300" : "text-blue-600";
        const borderColor = isDark ? "border-gray-700" : "border-gray-300";
        const bgCard = isDark ? "bg-[#1E293B]" : "bg-white";
        const mutedColor = isDark ? "text-gray-300" : "text-gray-600";
        const emptyTitle = isDark ? "text-gray-300" : "text-gray-700";
        const emptySub = isDark ? "text-gray-400" : "text-gray-500";

        const container = $(`#${opts.parent}`).empty();

        const header = $("<div>", {
            class: "p-4 border-b border-gray-700 flex justify-between items-center"
        }).append(
            $("<div>", { class: "flex flex-col" }).append(
                $("<h2>", { class: "text-lg font-semibold text-white", text: opts.title }),
                $("<h3>", {
                    class: "text-sm text-gray-400",
                    html: '<i class="icon-user-1"></i> ' + opts.customName || "Cliente no definido"
                },)
            ),
            $("<button>", {
                id: "clearOrder",
                class: "text-red-400 border border-[#C53030] px-2 py-1 rounded hover:bg-red-700",
                html: "🗑 Limpiar"
            })
        );

        const orderItems = $("<div>", {
            id: "orderItems",
            class: "flex-1 overflow-auto p-3 space-y-3"
        });

        const footer = $("<div>", {
            class: "px-3 py-2 border-t border-gray-700 bg-[#333D4C]"
        }).append(
            $("<div>", { class: "space-y-1 text-xs text-gray-300" }).append(
                $("<div>", { class: "flex items-center gap-1 mb-1" }).append(
                    $("<span>", { class: "text-green-400 text-sm" }).text("$"),
                    $("<span>", { class: "text-white font-semibold italic text-sm" }).text("Resumen de pago")
                ),
                $("<div>", {
                    class: "flex justify-between"
                }).append(
                    $("<span>").text("Subtotal:"),
                    $("<span>", { id: "subtotal", class: "text-white", text: "$0.00" })
                ),
                $("<div>", {
                    id: "discountRow",
                    class: "flex justify-between",
                    css: { display: "none" }
                }).append(
                    $("<span>").text("Descuento:"),
                    $("<span>", { id: "discountAmount", class: "text-yellow-400", text: "-$0.00" })
                ),
                $("<div>", {
                    id: "pagadoRow",
                    class: "flex justify-between",
                    css: { display: "none" }
                }).append(
                    $("<span>").text("Pagado:"),
                    $("<span>", { id: "pagado", class: "text-green-400", text: "$0.00" })
                ),
                $("<div>", {
                    id: "saldoRow",
                    class: "flex justify-between pt-1 mt-1 border-t border-gray-600"
                }).append(
                    $("<span>", { class: "font-semibold" }).text("Saldo:"),
                    $("<span>", { id: "saldo", class: "text-red-500 font-bold", text: "$0.00" })
                )
            ),
            $("<div>", { class: "grid grid-cols-3 gap-2 mt-2" }).append(
                $("<button>", {
                    id: "printOrder",
                    class: "border border-gray-600 text-white rounded px-2 py-1.5 text-xs",
                    html: "🖨 Imprimir"
                }),
                $("<button>", {
                    id: "finishOrder",
                    class: "bg-blue-700 text-white rounded px-2 py-1.5 text-xs hover:bg-blue-800",
                    html: "Terminar"
                }),
                $("<button>", {
                    id: "exitOrder",
                    class: "border bg-red-700 text-white rounded px-2 py-1.5 text-xs hover:bg-red-800 hover:text-white",
                    html: "Salir"
                })
            )
        );

        container.append(header, orderItems, footer);

        const data = [...opts.data];
        let totalAcc = 0;

        if (data.length === 0) {
            const empty = $("<div>", {
                class: "w-full h-full flex items-center justify-center"
            }).append(
                $("<div>", { class: "text-center" }).append(
                    $(`<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto mb-3" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#9CA3AF' : '#6B7280'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L21 6H6"></path>
                </svg>`),
                    $("<p>", { class: `text-base font-medium ${emptyTitle}`, text: opts.emptyTitle }),
                    $("<p>", { class: `text-sm mt-1 ${emptySub}`, text: opts.emptySub })
                )
            );
            orderItems.append(empty);
            if (opts.totalSelector) $(opts.totalSelector).text(formatPrice(0));
            return;
        }

        data.forEach((item, index) => {


            const card = $("<div>", {
                class: `flex justify-between items-center ${bgCard} border ${borderColor} rounded-xl p-3 shadow-sm`
            });

            const infoElements = [
                $("<p>", { class: `${textColor} font-medium text-sm`, text: item.name }),
                $("<p>", { class: `${subColor} font-semibold text-sm`, text: formatPrice(item.price) }),
                item.custom_id ? $("<span>", { class: "inline-flex items-center text-xs font-bold text-purple-400", text: "Personalizado" }) : null,
                item.dedication ? $("<p>", { class: `${mutedColor} text-xs italic`, text: `Dedicatoria: ${item.dedication}` }) : null,
                item.order_details ? $("<p>", { class: `${mutedColor} text-xs`, text: `Detalles: ${item.order_details}` }) : null,
                item.images && item.images.length > 0
                    ? $("<p>", {
                        class: `text-gray-400 text-xs`,
                        html: `<i class="icon-camera"></i> Pedido con ${item.images.length} foto${item.images.length > 1 ? 's' : ''} adjunta${item.images.length > 1 ? 's' : ''}`
                    })
                    : null
            ];

            const info = $("<div>", { class: "flex-1 space-y-1" }).append(...infoElements.filter(el => el !== null));

            const actions = $("<div>", { class: "flex flex-col items-end gap-2" });
            const quantityRow = $("<div>", { class: "flex items-center gap-2" });

            const quantityInput = $("<input>", {
                type: "number",
                class: `${textColor} bg-transparent border border-gray-600 rounded text-center w-16 focus:outline-none focus:border-blue-500`,
                value: item.quantity,
                min: 1
            });

            const self = this;

            quantityInput.on("focus", function() {
                $(this).select();
            });

            quantityInput.on("keyup", function(e) {
                const $input = $(this);
                const val = $input.val().replace(/[^0-9]/g, '');
                
                if ($input.val() !== val) {
                    $input.val(val);
                }
                
                let newQty = parseInt(val, 10);
                if (!isNaN(newQty) && newQty >= 1) {
                    item.quantity = newQty;
                    
                    const lineTotal = (item.price || 0) * newQty;
                    $input.closest('.shadow-sm').find('p').last().text(`Total: ${formatPrice(lineTotal)}`);
                    
                    let total = 0;
                    data.forEach(i => total += (i.price || 0) * (i.quantity || 0));
                    if (opts.totalSelector) $(opts.totalSelector).text(formatPrice(total));
                }
            });
            
            quantityInput.on("focusout", function() {
                const $input = $(this);
                let newQty = parseInt($input.val(), 10);
                if (isNaN(newQty) || newQty < 1) {
                    newQty = 1;
                    $input.val(1);
                    item.quantity = 1;
                }
                opts.onQuanty(item.id, 1, item.quantity);
            });

            const buttons = [
                $("<button>", {
                    class: "bg-gray-700 text-white rounded px-2",
                    html: "−",
                    click: () => {
                        if (item.quantity > 1) {
                            item.quantity--;
                            opts.onQuanty(item.id, 0, item.quantity);
                            opts.data = data;
                            this.orderPanelComponent(opts);
                        }
                    }
                }),
                quantityInput,
                $("<button>", {
                    class: "bg-gray-700 text-white rounded px-2",
                    html: "+",
                    click: () => {
                        item.quantity++;
                        opts.onQuanty(item.id, 2, item.quantity);
                        opts.data = data;
                        this.orderPanelComponent(opts);
                    }
                })
            ];

            buttons.push(
                $("<button>", {
                    class: "text-blue-400 hover:text-blue-600",
                    html: `<i class="icon-pencil"></i>`,
                    click: () => {
                        // Detectar si es pedido personalizado o normal
                        if (item.custom_id) {
                            opts.onCake(item.id, item.custom_id);
                        } else {
                            opts.onEdit(item.id);
                        }
                    }
                }),
                $("<button>", {
                    class: "text-gray-400 hover:text-red-400",
                    html: `<i class="icon-trash"></i>`,
                    click: () => {
                        data.splice(index, 1);
                        opts.onRemove(item.id);
                        opts.data = data;
                        this.orderPanelComponent(opts);
                    }
                })
            );

            quantityRow.append(...buttons);

            const lineTotal = (item.price || 0) * (item.quantity || 0);
            totalAcc += lineTotal;

            const totalEl = $("<p>", {
                class: `${mutedColor} text-sm `,
                text: `Total: ${formatPrice(lineTotal)}`
            });

            actions.append(quantityRow, totalEl);
            card.append(info, actions);
            orderItems.append(card);
        });

        if (opts.totalSelector) {
            const subtotal = totalAcc;
            const discount = parseFloat(opts.discount) || 0;
            const finalTotal = subtotal - discount;
            const totalPaid = parseFloat(opts.totalPaid) || 0;
            const saldo = finalTotal - totalPaid;
            
            $('#subtotal').text(formatPrice(subtotal));
            
            if (discount > 0) {
                $('#discountRow').show();
                $('#discountAmount').text(`-${formatPrice(discount)}`);
            }
            
            if (totalPaid > 0) {
                $('#pagadoRow').show();
                $('#pagado').text(formatPrice(totalPaid));
            }
            
            if (saldo > 0) {
                $('#saldoRow').show();
                $('#saldo').text(formatPrice(saldo)).removeClass('text-green-400').addClass('text-red-500');
            } else if (saldo <= 0 && totalPaid > 0) {
                $('#saldoRow').show();
                $('#saldo').text(formatPrice(0) + ' ✓').removeClass('text-red-500').addClass('text-green-400');
            } else {
                $('#saldo').text(formatPrice(finalTotal));
            }
        }

        // 🔁 Delegación segura para botones
        const $orderPanel = $(`#${opts.parent}`);
        $orderPanel.off("click", "#clearOrder").on("click", "#clearOrder", () => {
            if (typeof opts.onClear === "function") opts.onClear();
        });
        $orderPanel.off("click", "#printOrder").on("click", "#printOrder", () => {
            if (typeof opts.onPrint === "function") opts.onPrint(opts.data);
        });
        $orderPanel.off("click", "#exitOrder").on("click", "#exitOrder", () => {
            if (typeof opts.onExit === "function") opts.onExit();
        });
        $orderPanel.off("click", "#finishOrder").on("click", "#finishOrder", () => {
            if (typeof opts.onFinish === "function") opts.onFinish(opts.data);
        });
    }

    // auxiliares.
    searchFilter(options) {
        const opts = Object.assign({
            parent: "searchProduct",
            gridId: "productGrid",
            selector: ".card",
            targetTextSelector: "h3"

        }, options);

        const input = $(`#${opts.parent}`);
        const grid = document.querySelector(`#${opts.gridId}`);

        console.log(input, grid);

        if (!input.length || !grid) return;

        const search = () => {
            const keyword = input.val().toLowerCase().trim();
            const cards = grid.querySelectorAll(opts.selector);

            cards.forEach(card => {
                const label = card.querySelector(opts.targetTextSelector)?.textContent.toLowerCase() || "";
                card.style.display = label.includes(keyword) ? "" : "none";
            });
        };

        input.off("input").on("input", search);
    }

}

class CatalogProduct extends Pos {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "CatalogProduct";
        this.name_client = '';
        this.discount  = '';
        this.layoutEdit = false;
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.formCreateOrder();
        this.layoutPos();
    }

    layout() {

        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "flex mx-2 my-2 p-2",
            heightPreset: 'viewport', // Usa el preset estándar
            card: {
                filterBar: {
                    id: "filterBar" + this.PROJECT_NAME,
                    class: "w-full"
                },
                container: {
                    class: "w-full my-3  bg-[#1F2A37] rounded-lg p-3",
                },
            },
        });
    }

    formCreateOrder() {

        const isEditMode = this.layoutEdit;



        this.tabLayout({
            parent: "container" + this.PROJECT_NAME,
            id: "tabsPedido",
            theme: "dark",
            type: 'short',
            content: { class: "h-[calc(100vh-200px)] overflow-y-auto" },
            json: [
                {
                    id: "pedido",
                    tab: isEditMode ? "Información del pedido" : "Crear orden de pedido",
                    active: !isEditMode
                },
                {
                    id: "package",
                    tab: "Catálogo de productos",
                    active: isEditMode
                }
            ]
        });

        // Agregar select de sucursales antes del tabLayout




        app.addOrder();
    }

    // System Pos.

    layoutPos() {


        if (!idFolio) {
            $("#container-package").html(`
             <div class="w-full p-6 bg-[#1F2A37] text-center rounded-lg">
                <div class="flex justify-center mb-4">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center bg-purple-500 ">
                        <i class="icon-birthday text-white text-2xl"></i>
                    </div>
                </div>
                <h2 class="text-lg font-bold text-purple-400">Sin Órdenes Activas</h2>
                <p class="text-gray-300 mt-2">
                    Para comenzar a agregar productos a tu carrito, primero necesitas
                    <a href="#" id="btnNuevaOrden" class="text-blue-400 ">iniciar una nueva orden</a>.
                </p>
            </div>
            `);
            return;
        }

        this.createPOSContainers({
            parent: "container-package",
            id: "pedido",
            theme: 'dark',
            onChange: (item) => {
                this.searchFilter({ parent: 'searchProduct' })
            }
        });

        this.initPos();
    }

    async initPos() {

        const pos = await useFetch({ url: this._link, data: { opc: "init", id: idFolio } });

        if (!pos) {
            console.error("Error: No se pudo cargar la información del catálogo", pos);
            $("#productGrid").html(`
                <div class="col-span-full text-center text-gray-400 py-10">
                    <i class="icon-alert text-3xl mb-2"></i>
                    <p>No se pudieron cargar los productos. Intenta recargar.</p>
                </div>
            `);
            return;
        }

        this.name_client = pos.order?.name ?? '';
        this.discount = pos.order?.discount ?? '';
        this.payments = pos.payments ?? [];
        this.total_paid = pos.total_paid ?? 0;

        this.createProductTabs({
            data: pos.modifier || [],
            onChange: (category) => {
                this.listProduct(category)
            }
        });

        // Products.

        this.createProductGrid({
            data: pos.products || [],
            onClick: (item) => {
                this.addProduct(item.id)
            }
        });


        this.showOrder(pos.list || [])
    }

    showOrder(list) {

        this.orderPanelComponent({
            title: `Orden Actual #P-00${idFolio}`,
            parent: "orderPanel",
            discount: this.discount,
            customName: this.name_client,
            data: list,
            payments: this.payments,
            totalPaid: this.total_paid,

            onFinish: (data) => {
                console.log('finish')
                this.addPayment();
            },
            onEdit: (id) => {
                this.editProduct(id);
            },
            onRemove: (id) => {
                this.removeProduct(id);
            },
            onQuanty: (id, action, newQuantity) => {
                this.quantityProduct(id, newQuantity);
            },
            onPrint: () => {
                this.printOrder(idFolio);
            },

            onExit: () => {
                app.render();
            },

            onClear: () => {
                this.confirmClearOrder(idFolio);
            },

            onCake: (productId, pedidoCustomId) => {
                // Abrir modal de edición del pastel personalizado
                custom.renderEdit(productId, pedidoCustomId);
            },
        });

    }

    // Product.

    async listProduct(id) {

        const pos = await useFetch({ url: this._link, data: { opc: "lsProducto", id: id } });

        this.createProductGrid({
            data: pos.products,
            onClick: (item) => {
                this.addProduct(item.id)
            }
        });


    }

    async addProduct(product_id) {

        const pos = await useFetch({
            url: this._link,
            data: {
                opc: "addProduct",
                quantity: 1,
                pedidos_id: idFolio,
                product_id: product_id
            }
        });

        this.showOrder(pos.list)


    }

    async removeProduct(id) {
        const pos = await useFetch({
            url: this._link,
            data: {
                opc: "removeProduct",
                pedidos_id: idFolio,
                id: id
            }
        });

    }

    confirmClearOrder(id) {

        this.swalQuestion({
            opts: {
                title: "¿Desea eliminar todos los productos del ticket?",
                text: "Esta acción vaciará el pedido actual.",
                icon: "warning"
            },
            data: {
                opc: "deleteAllProducts",
                pedidos_id: idFolio
            },
            methods: {
                send: (response) => {
                    if (response?.status == 200) {
                        alert({ icon: "success", text: response.message || "Ticket limpiado." });

                        this.renderCart({
                            data: response.list,
                            onEdit: (id) => {
                                console.log('edit', id);
                                this.editProduct(id);
                            },
                            onRemove: (id) => {
                                this.removeProduct(id);
                            }
                        });

                    } else {
                        alert({ icon: "info", title: "Oops!...", text: response?.message || "No se pudo limpiar el ticket." });
                    }
                }
            }
        });
    }

    async editProduct(id) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getProduct",
                id: id
            }
        });

        let product = request.data;
        const isCustom = product.custom_id && product.custom_id !== null && product.custom_id !== '';

        const modal = bootbox.dialog({
            closeButton: true,
            title: `<h2 class="text-lg "> 🎂 ${product.name} </h2>`,
            message: `<div><form id="formEditProducto" novalidate></form></div>`
        });

        const formFields = [
            {
                opc: "input",
                id: "dedication",
                lbl: "dedicatoria",
                class: "col-12  mb-3",
            },
            {
                opc: "textarea",
                id: "order_details",
                lbl: "Observaciones",
                class: "col-12 mb-3",
                height: 32,
                disabled: true
            }
        ];

        if (isCustom) {
            formFields.push({
                opc: "div",
                id: "image",
                lbl: "Imagenes de referencia del producto",
                class: "col-12 ",
                html: `
                    <div class="col-12 mt-2 mb-2">
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
            });
        }

        formFields.push({
            opc: "button",
            id: "btnEditProducto",
            class: "col-12 ",
            className: "w-full p-2",
            text: "Actualizar Producto",
            onClick: () => {

                const form = document.getElementById('formEditProducto');
                const formData = new FormData(form);

                formData.append('opc', 'editProduct');
                formData.append('id', id);
                formData.append('idFolio', idFolio);

                if (isCustom) {
                    const files = document.getElementById('archivos').files;
                    for (let i = 0; i < files.length; i++) {
                        formData.append('archivos[]', files[i]);
                    }
                }

                fetch(this._link, {
                    method: 'POST',
                    body: formData
                })
                    .then(response => response.json())
                    .then(response => {

                        if (response.status === 200) {

                            this.showOrder(response.list);

                            modal.modal('hide');
                            alert({ icon: "success", text: response.message });

                        } else {

                            alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                        }
                    });
            }
        });

        this.createForm({
            id: 'formEditProductoInternal',
            parent: 'formEditProducto',
            autovalidation: false,
            autofill: product,
            data: { opc: 'editProduct', id: id },
            json: formFields
        });

        if (isCustom) {
            this.renderImages(request.images, 'previewImagenes');
        }
    }

    async quantityProduct(packageId, newQuantity) {
        const response = await useFetch({
            url: this._link,
            data: {
                opc: "quantityProduct",
                id: packageId,
                quantity: newQuantity,
                pedidos_id: idFolio
            }
        });
        this.showOrder(response.list)
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

                    img.classList.add("w-28", "h-28", "object-cover", "rounded");
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


        imageList.forEach(imgData => {

            const img = document.createElement("img");
            img.src = urlBase + imgData.path;
            img.alt = imgData.original_name || "Imagen del producto";

            img.classList.add("w-32", "h-32", "object-cover", "rounded", "border");
            previewContainer.appendChild(img);
        });
    }


    // Pos.
    async printOrder() {

        const pos = await useFetch({
            url: api,
            data: { opc: "getOrderDetails", id: idFolio }
        });

        const modal = bootbox.dialog({
            closeButton: true,
            title: ` <div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-print text-blue-400 text-xl"></i>
                        Imprimir
                    </div>`,
            message: ` <div id="containerPrintOrder"></div>`
        });

        console.log('pos',pos)

        this.ticketPasteleria({
            parent: 'containerPrintOrder',
            data: {
                head: pos.data.order,
                products: pos.data.products,
                paymentMethods: pos.data.paymentMethods || []
            }
        })

    }

    createTicket(options) {
        const defaults = {
            parent: "container", // contenedor donde se insertará
            data: {
                head: { data: {} },
                row: [],
                products: []
            }
        };

        const opts = Object.assign({}, defaults, options);
        const parent = opts.parent;
        const data = opts.data.head.data || {};
        const products = opts.data.products || [];

        const cliente = data.cliente || "[cliente]";
        const fecha = data.pedido || "[fecha]";
        const hora = data.horapedido || "[hora]";
        const observacion = data.observacion || "[nota]";
        const costo = data.total || 0;
        const anticipo = data.anticipo || 0;
        const restante = costo - anticipo;
        const container = $("<div>", { id: "containerTicks", class: "bg-white text-gray-800 rounded-lg mb-4 font-mono p-4" });

        // Header
        container.append(`
        <div class="flex flex-col items-center">
            <img src="https://erp-varoch.com/ERP24/src/img/udn/fz_black.png" alt="Panadería y pastelería" class="w-48 max-w-full mt-2" />
            <h1 class="p-2 text-center font-bold">PEDIDOS DE PASTELERÍA</h1>
        </div>`);

        container.append(`
        <div class="flex-1 text-xs  space-y-4">
            <div class="flex justify-between gap-6">
                <div>
                    <div class="font-bold">NOMBRE:</div>
                    <div class="uppercase">${cliente}</div>
                </div>
                <div>
                    <div class="font-bold">FECHA Y HORA DE ENTREGA:</div>
                    <div class="uppercase">${fecha} ${hora}</div>
                </div>
            </div>
            <div>
                <div class="font-bold">NOTA:</div>
                <div>${observacion}</div>
            </div>
            <hr class="border-dashed" />
        </div>
    `);

        // Productos
        let totalProductos = 0;
        if (products.length > 0) {
            container.append(`
                <div class="text-xs font-mono px-2 mt-2">
                    <div class="text-center font-bold mb-2">PRODUCTOS</div>
                    <div class="flex justify-between  py-3">
                        <div class="w-1/6">CANT.</div>
                        <div class="w-3/6">DESCRIPCIÓN</div>
                        <div class="w-2/6 text-right">IMPORTE</div>
                    </div>

                    ${products.map(product => {
                const price = parseFloat(product.price || 0);
                const quantity = parseInt(product.quantity || 1);
                const total = price * quantity;
                totalProductos += total;

                return `
                            <div class="flex justify-between py-1">
                                <div class="w-1/6">${quantity}</div>
                                <div class="w-3/6 truncate">${product.name}</div>
                                <div class="w-2/6 text-right">${product.price}</div>
                            </div>
                            ${product.dedication ? `<div class="pl-4 italic text-[10px] text-gray-600">* ${product.dedication}</div>` : ""}
                        `;
            }).join("")}

                    <div class="border-t my-2 pt-2 text-right font-bold">
                        TOTAL PRODUCTOS: ${formatPrice(totalProductos)}
                    </div>
                </div>
            `);


        }




        $(`#${parent}`).html(container);
    }

    ticketPasteleria(options) {
        const defaults = {
            parent: "root",
            id: "ticketPasteleria",
            class: "bg-white p-4 rounded-lg shadow text-gray-900",
            data: {
                head: {
                    folio: "",
                    is_quote: false,
                    name: "[cliente]",
                    phone: "",
                    date_order: "[fecha]",
                    time_order: "[hora]",
                    notes: "[nota]",
                    total_pay: 0,
                    anticipo: 0,
                    forma_pago: ""
                },
                products: [],
                clausules: []
            }
        };

        const opts = Object.assign({}, defaults, options);
        const data = opts.data.head || {};
        const productos = opts.data.products || [];
        const clausules = opts.data.clausules || [];

        const total = parseFloat(data.total_pay || 0);
        const anticipo = parseFloat(data.anticipo || 0);

        function formatPrice(value) {
            return `$${parseFloat(value || 0).toFixed(2)}`;
        }

        const layout = $("<div>", {
            id: 'layoutPrintTicket',
            class: ''
        });

        const btnContainer = $("<div>", {
            class: 'flex justify-end mb-3 no-print'
        });

        const btnPrint = $("<button>", {
            id: "btnPrintTicket",
            class: "bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-2",
            html: '<i class="icon-print"></i> Imprimir ',
            click: () => {
                const ticketContent = document.getElementById('ticketPasteleria');
                if (ticketContent) {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                        alert('Por favor permite las ventanas emergentes para imprimir el ticket');
                        return;
                    }
                    printWindow.document.write(`
                        <html>
                            <head>
                                <title>Ticket de Pedido</title>
                                <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                                <style>
                                    html, body {
                                        margin: 0;
                                        padding: 0;
                                        width: 100%;
                                        height: 100%;
                                        font-family: 'Consolas', 'Roboto Mono', 'Lucida Console', monospace;
                                        font-size:12px;
                                        background: white;
                                    }

                                    * {
                                        box-sizing: border-box;
                                    }

                                    #ticketPasteleria {
                                        width: 100%;
                                        max-width: 100%;
                                        margin: 0;
                                        padding: 1rem;
                                    }

                                    @page {
                                        margin: 0;
                                        size: auto;
                                    }

                                    @media print {
                                        html, body {
                                            margin: 0;
                                            padding: 0;
                                            width: 100%;
                                            height: auto;
                                        }
                                        
                                        #ticketPasteleria {
                                            box-shadow: none !important;
                                            border-radius: 0 !important;
                                        }
                                        
                                        #lblFecha {
                                            text-align: right !important;
                                        }
                                    }
                                </style>
                            </head>
                            <body>
                                ${ticketContent.outerHTML}
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                        printWindow.close();
                    }, 250);
                }
            }
        });

        btnContainer.append(btnPrint);
        layout.append(btnContainer)



        const container = $("<div>", {
            id: opts.id,
            class: "bg-white p-4 rounded-lg shadow text-gray-900",
            css: {
                fontFamily: "Consolas, 'Roboto Mono', 'Lucida Console', monospace",
                minHeight: "600px",
                margin: "0 auto"
            }
        });

        const header = `
            <div class="flex flex-col items-center mb-4 mt-3">
                ${data.logo ? `<img src="https://huubie.com.mx/alpha${data.logo}" alt="Logo" class="w-24 h-24 mb-1  " />` : ""}
                ${data.company ? `<div class="text-xs font-semibold uppercase mb-1">${data.company}</div>` : ""}
                ${data.subsidiarie_name ? `<div class="text-xs uppercase">${data.subsidiarie_name}</div>` : ""}
                <h1 class="text-lg font-bold">PEDIDOS DE PASTELERÍA</h1>
                ${data.status == 1 ? `<div class="text-xs font-bold text-red-600 uppercase">COTIZACIÓN</div>` : ""}
            </div>
            <div class="text-sm space-y-2">
                ${data.folio ? `
                <div class="flex justify-between">
                    <div>
                        <div class="font-semibold">FOLIO:</div>
                        <div class="uppercase">P-00${data.folio}</div>
                    </div>
                    <div>
                        <div class="font-semibold">FECHA Y HORA DE ENTREGA:</div>
                        <div id="lblFecha" class="uppercase text-end">${data.date_order} ${data.time_order}</div>
                    </div>
                </div>` : ""}
                
                <div>
                    <div class="font-semibold">NOMBRE:</div>
                    <div class="uppercase">${data.name}</div>
                </div>

                ${data.notes ? `
                <div>
                    <div class="font-semibold">NOTA:</div>
                    <div>${data.notes}</div>
                </div>` : ""}
                <hr class="border-dashed border-t my-2" />
            </div> `;



        let listaProductos = "";
        if (productos.length > 0) {
            listaProductos += `
                <div class="text-xs mt-3">
                    <div class="text-center font-bold mb-2">PRODUCTOS</div>
                    <div class="flex justify-between pb-2 font-semibold ">
                    <div class="w-1/6">CANT.</div>
                    <div class="w-3/6">DESCRIPCIÓN</div>
                    <div class="w-2/6 text-right">IMPORTE</div>
                </div>

        `;

            listaProductos += productos.map(product => {
                const quantity = parseInt(product.quantity || 1);
                const price = parseFloat(product.price || 0);
                const subtotal = quantity * price;

                let descriptionHtml = `<div class="capitalize font-bold">${product.name}${product.custom_id ? ' (Personalizado)' : ''}</div>`;

                if (product.customer_products && Array.isArray(product.customer_products) && product.customer_products.length > 0) {
                    descriptionHtml += `<div class="capitalize">Porción: ${product.portion_qty || 1}</div>`;
                    product.customer_products.forEach(cp => {
                        descriptionHtml += `<div class="text-[10px]  ml-1">-${cp.modifier_name}: ${cp.name} x ${cp.quantity || 1}</div>`;
                    });
                }

                if (product.dedication) {
                    descriptionHtml += `<div class="text-[10px] font-semibold ml-1">Dedicatoria: ${product.dedication}</div>`;
                }

                return `
                <div class="flex justify-between py-1 pb-2">
                    <div class="w-1/6">${quantity}</div>
                    <div class="w-3/6">${descriptionHtml}</div>
                    <div class="w-2/6 text-right">${formatPrice(subtotal)}</div>
                </div>
            `;
            }).join("");

            listaProductos += `</div>`;
        }

        const totales = (() => {
            const hasAbono = anticipo > 0;
            const paymentMethods = opts.data.paymentMethods || [];
            const discount = parseFloat(data.discount || 0);
            const hasDiscount = discount > 0;
            const totalConDescuento = total - discount;
            const hasMovimientos = hasAbono || (Array.isArray(paymentMethods) && paymentMethods.length > 0);

            if (!hasMovimientos) {
                return `
                <hr class="border-dashed border-t my-2" />
                <div class="text-right text-sm mt-4 space-y-1">
                    ${hasDiscount ? `
                        <div class="text-base">Subtotal: <span class="font-semibold">${formatPrice(total)}</span></div>
                        <div class="">Descuento: <span class="font-semibold">-${formatPrice(discount)}</span></div>
                        <div class="text-xl font-bold">TOTAL: ${formatPrice(totalConDescuento)}</div>
                    ` : `
                        <div class="text-xl font-bold">TOTAL: ${formatPrice(total)}</div>
                    `}
                </div>`;
            }

            const desglosePagos = [];
            let totalPagado = 0;

            if (hasAbono) {
                desglosePagos.push(`<div class="font-bold">Anticipo: ${formatPrice(anticipo)}</div>`);
                totalPagado += anticipo;
            }

            if (Array.isArray(paymentMethods)) {
                paymentMethods.forEach(pm => {
                    const monto = parseFloat(pm.pay || 0);
                    totalPagado += monto;
                    desglosePagos.push(
                        `<div class="text-sm">${pm.method_pay}: <span class="font-semibold">${formatPrice(monto)}</span></div>`
                    );
                });
            }

            const restante = totalConDescuento - totalPagado;

            return `
    <hr class="border-dashed border-t my-2" />
    <div class="text-right text-sm mt-4 space-y-1">
        <div class="text-base">Subtotal: <span class="font-semibold">${formatPrice(total)}</span></div>
        ${hasDiscount ? `<div class="">Descuento: <span class="font-semibold">-${formatPrice(discount)}</span></div>` : ''}
        ${desglosePagos.join("")}
        <div class="text-xl font-bold mt-2">RESTANTE: ${formatPrice(restante)}</div>
    </div>`;
        })();





        const clausulesSection = clausules.length > 0 ? `
        <div class="mt-4 text-[12px] ">
            <hr class="border-dashed border-t my-2" />
            <div class="font-bold mb-2">RECOMENDACIONES:</div>
            <ul class="list-disc list-inside space-y-1">
                ${clausules.map(c => `<li>${c.name}</li>`).join("")}
            </ul>
        </div>
    ` : "";

        const footer = `
        <div class="text-center mt-6 text-xs font-bold text-gray-900 space-y-1">
            <p>ESTE NO ES UN COMPROBANTE FISCAL</p>
            <p class=" text-sm">Huubie</p>
            <p class="mt-2">GRACIAS POR SU PREFERENCIA</p>
        </div>
    `;

        container.append(header);
        container.append(listaProductos);
        container.append(totales);
        container.append(footer);
        container.append(clausulesSection);

        layout.append(container)

        $(`#${opts.parent}`).html(layout);
    }


    // payment.

    async addPayment() {

        let saldo, saldoOriginal, total, total_paid, saldo_restante, discount;
        const req      = await useFetch({ url: api, data: { opc: "getPayment", id: idFolio } });
        const response = req.order;


        if (req.total_paid) {

            discount       = parseFloat(response.discount) || 0;
            saldo          = formatPrice(response.total_pay);
            saldoOriginal  = response.total_pay;
            total          = response.total_pay - discount;
            total_paid     = req.total_paid;
            saldo_restante = total - total_paid;

        } else {
            const totalText = $('#subtotal').text();
            saldo = totalText;
            saldoOriginal = totalText.replace(/[^0-9.-]+/g, "") || "0";
            discount = parseFloat($('#discountAmount').text().replace(/[^0-9.-]+/g, "")) || 0;
            total = parseFloat(saldoOriginal) || 0;
            total = total - discount;
            total_paid = 0;
            saldo_restante = total - total_paid;
        }

        this.createModalForm({
            id: "modalRegisterPayment",
            bootbox: {
                title: `
                <div class="flex items-center gap-2 text-white text-lg font-semibold">
                    <i class="icon-dollar text-blue-400 text-xl"></i>
                    Registrar Pago
                </div>`,
                id: "registerPaymentModal",
                size: "medium"
            },
            data: { opc: 'addPayment', total: total, saldo: saldo_restante, id: idFolio, discount: discount, total_paid: total_paid },
            json: [
                this.cardPay(total, total_paid, discount),
                {
                    opc  : "div",
                    id   : "anticipoSwitch",
                    class: "col-12 mb-2",
                    html: `
                    <div class = "flex items-center justify-between text-white p-3 rounded-lg border border-gray-700 bg-[#1F2937]">
                        <div   class = "flex items-center gap-2">
                            <i     id    = "iconAnticipo" class  = "icon-minus-square text-gray-400 transition-colors duration-200"></i>
                            <label id    = "labelAnticipo" class = "text-sm">Dejar abono</label>
                        </div>

                        <label class = "inline-flex items-center cursor-pointer relative">
                        <input type  = "checkbox" id = "toggleAnticipo" class = "sr-only peer" onchange = "normal.toggleExtraFields()">
                        <div   class = "w-11 h-6 bg-gray-700 peer-checked:bg-blue-600 rounded-full transition-colors duration-300"></div>
                        <div   class = "absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 peer-checked:translate-x-5"></div>
                        </label>
                    </div>
                     `
                },
                {
                    opc        : "input",
                    type       : "number",
                    id         : "advanced_pay",
                    lbl        : "Importe",
                    class      : "col-12 mb-3 hidden",
                    placeholder: "$ 0",
                    required   : false,
                    min        : 0,
                    onkeyup    : 'normal.updateTotal(' + total + ', ' + (total_paid || 0) + ')'
                },
                {
                    opc: "select",
                    id: "method_pay_id",
                    lbl: "Método de pago del anticipo",
                    class: "col-12 mb-3 hidden",
                    data: [
                        { id: "1", valor: "Efectivo" },
                        { id: "2", valor: "Tarjeta" },
                        { id: "3", valor: "Transferencia" }
                    ],
                    required: true
                },
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, timer: 1500 });
                    app.render();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });

        const $btn = $("#btnSuccess");
        const originalHandlers = $._data($btn[0], "events")?.click?.map(e => e.handler) || [];
        $btn.off("click");
        $btn.on("click", function () {
            const abono = parseFloat($("#advanced_pay").val()) || 0;
            if (abono <= 0 && total_paid <= 0) {
                alert({
                    icon: "question",
                    title: "Sin abono",
                    text: "No se registró ningún abono. El pedido se guardará como cotización. ¿Deseas continuar?",
                    btn1Text: "Sí, continuar",
                    btn2Text: "Cancelar",
                }).then((result) => {
                    if (result.isConfirmed) {
                        originalHandlers.forEach(fn => fn());
                    }
                });
            } else {
                originalHandlers.forEach(fn => fn());
            }
        });

        $btn.addClass("text-white");
        $("#btnExit").addClass("text-white");
    }

    cardPay(total, total_paid = 0, discount = 0) {
        const restante = total - total_paid;
        const subtotal = total + discount;

        // Si no hay abonos previos, solo se muestra el monto restante
        if (!total_paid || total_paid <= 0) {
            return {
                opc: "div",
                id: "Amount",
                class: "col-12 mb-2",
                html: `
                <div id="dueAmount" class="p-4 rounded-xl bg-[#1E293B] text-white text-center">
                    ${discount > 0 ? `
                    <p class="text-sm opacity-80">Subtotal</p>
                    <p class="text-lg font-semibold text-gray-400 line-through">${formatPrice(subtotal)}</p>
                    <p class="text-sm text-green-400 mb-2">Descuento: -${formatPrice(discount)}</p>
                    ` : ''}
                    <p class="text-sm opacity-80">Monto a pagar</p>
                    <p id="SaldoEvent" class="text-3xl font-bold mt-1">
                        ${formatPrice(restante)}
                    </p>
                </div>

            `
            };
        }

        // Si hay abono previo, mostrar resumen completo
        return {
            opc: "div",
            id: "Amount",
            class: "col-12 mb-2",
            html: `
           <div id="dueAmount" class="p-4 rounded-xl bg-[#1E293B] text-white space-y-4 border border-slate-800 shadow-sm">

                ${discount > 0 ? `
                <!-- Subtotal -->
                <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold">Subtotal</span>
                    <div class="text-right text-gray-400 line-through">
                        ${formatPrice(subtotal)}
                    </div>
                </div>

                <!-- Descuento -->
                <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold text-green-400">Descuento</span>
                    <div class="text-right text-green-400 font-bold">
                        -${formatPrice(discount)}
                    </div>
                </div>
                ` : ''}

                <!-- Total de la venta -->
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold">Total de la venta</span>
                    </div>
                    <div class="text-right text-white font-bold text-lg">
                        ${formatPrice(total)}
                    </div>
                </div>

                <!-- Abono previo -->
                <div class="flex justify-between items-center bg-blue-900/30 p-2 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i class="icon-check text-blue-400"></i>
                        <span class="text-sm font-semibold text-blue-300">Abono registrado</span>
                    </div>
                    <div class="text-right text-blue-400 font-bold">
                        ${formatPrice(total_paid)}
                    </div>
                </div>

                <hr class="border-slate-600">

                <!-- Monto restante -->
                <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold">Restante</span>
                    <div id="SaldoEvent" class="text-right text-white font-bold text-md">
                        ${formatPrice(restante)}
                    </div>
                </div>
            </div>

        `
        };
    }

    updateTotal(totalOriginal, totalPaid = 0) {
        const input = document.getElementById("advanced_pay");
        const display = document.getElementById("SaldoEvent");
        const btnOk = document.getElementById("btnSuccess");
        const btnExit = document.getElementById("btnExit");

        if (!input || !display) return;

        let anticipo = parseFloat(input.value) || 0;
        let restante = totalOriginal - totalPaid - anticipo;

        // Validación: no permitir que anticipo exceda el monto disponible
        if (anticipo + totalPaid > totalOriginal) {
            anticipo = totalOriginal - totalPaid;
            input.value = anticipo.toFixed(2);
            restante = 0;
        }

        display.textContent = `$${restante.toFixed(2)}`;

        // Activar o desactivar botones según el valor del anticipo
        const isValid = anticipo > 0;

        if (btnOk) btnOk.disabled = !isValid;
        if (btnExit) btnExit.disabled = !isValid;
    }

    toggleExtraFields() {
        const show = document.getElementById("toggleAnticipo")?.checked;

        const advancedPay = document.getElementById("advanced_pay")?.parentElement;
        const advancedPayInput = document.getElementById("advanced_pay");
        const methodPay = document.getElementById("method_pay_id")?.parentElement;
        const btnOk = document.getElementById("btnSuccess");

        const icon = document.getElementById("iconAnticipo");
        const label = document.getElementById("labelAnticipo");

        if (show) {
            advancedPay?.classList.remove("hidden");
            methodPay?.classList.remove("hidden");

            if (icon) icon.className = "icon-check-square text-blue-400 transition-colors duration-200";
            if (label) label.textContent = "Abono selecionado";

            const anticipo = parseFloat(advancedPayInput?.value) || 0;
            if (btnOk) btnOk.disabled = anticipo <= 0;
        } else {
            advancedPay?.classList.add("hidden");
            methodPay?.classList.add("hidden");

            if (icon) icon.className = "icon-minus-square text-gray-400 transition-colors duration-200";
            if (label) label.textContent = "Dejar abono";

            if (btnOk) btnOk.disabled = false;
        }
    }

    // Products.
    showProductDetails(productId, options = {}) {
        const defaults = {
            theme: "dark"
        };

        const opts = Object.assign({}, defaults, options);

        // Fetch product details from backend
        useFetch({
            url: this._link,
            data: {
                opc: "getProductDetails",
                id: productId
            }
        }).then(response => {
            if (response.status === 200) {
                const product = response.data;
                const baseUrl = "https://huubie.com.mx/";

                // Create modal with bootbox
                const modal = bootbox.dialog({
                    title: `<div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-info text-blue-400 text-xl"></i>
                        Detalles del Producto
                    </div>`,
                    message: `
                        <div class="flex flex-col md:flex-row gap-4 bg-[#1F2A37] text-white rounded-lg overflow-hidden">
                            <!-- Left Pane - Product Image -->
                            <div class="w-full md:w-1/2 bg-gray-800 flex items-center justify-center min-h-[300px]">
                                ${product.image && product.image.trim() !== ""
                            ? `<img src="${baseUrl}${product.image}" alt="${product.name}" class="object-cover w-full h-full rounded-lg">`
                            : `<div class="flex items-center justify-center w-full h-full">
                                         <i class="icon-birthday text-6xl text-gray-500"></i>
                                       </div>`
                        }
                            </div>
                            
                            <!-- Right Pane - Product Details -->
                            <div class="w-full md:w-1/2 p-4 flex flex-col justify-between">
                                <div>
                                    <h2 class="text-2xl font-bold text-white mb-2">${product.name}</h2>
                                    
                                    ${product.category
                            ? `<span class="inline-block px-3 py-1 text-sm bg-blue-600 text-white rounded-full mb-3">${product.category}</span>`
                            : ''
                        }
                                    
                                    <div class="mb-4">
                                        <p class="text-sm text-gray-400 mb-1">Precio</p>
                                        <p class="text-3xl font-bold text-blue-400">${formatPrice(product.price)}</p>
                                    </div>
                                    
                                    ${product.description
                            ? `<div class="mb-4">
                                             <p class="text-sm text-gray-400 mb-2">Descripción</p>
                                             <p class="text-gray-300 leading-relaxed">${product.description}</p>
                                           </div>`
                            : ''
                        }
                                </div>
                                
                                <div class="mt-4">
                                    <button id="addToCartFromModal" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200">
                                        <i class="icon-cart mr-2"></i>
                                        Agregar al carrito
                                    </button>
                                </div>
                            </div>
                        </div>
                    `,
                    size: 'large',
                    closeButton: true,
                    className: 'product-details-modal'
                });

                // Add event handler for "Add to Cart" button
                $(document).off('click', '#addToCartFromModal').on('click', '#addToCartFromModal', () => {
                    this.addProduct(productId);
                    modal.modal('hide');
                });

            } else {
                alert({
                    icon: "error",
                    title: "Error",
                    text: response.message || "No se pudieron cargar los detalles del producto",
                    btn1: true,
                    btn1Text: "Ok"
                });
            }
        }).catch(error => {
            console.error('Error fetching product details:', error);
            alert({
                icon: "error",
                title: "Error",
                text: "Error de conexión al cargar los detalles del producto",
                btn1: true,
                btn1Text: "Ok"
            });
        });
    }
}




