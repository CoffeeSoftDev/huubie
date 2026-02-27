class Existencias extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "existencias";
        this._link = apiExistencias;
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderExistencias();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "w-full p-3",
            card: {
                filterBar: { class: "w-full mb-3", id: `containerFilterBar${this.PROJECT_NAME}` },
                container: { class: "w-full h-full", id: `container${this.PROJECT_NAME}` }
            }
        });

        $(`#containerFilterBar${this.PROJECT_NAME}`).prepend(`
            <div id="summaryCards${this.PROJECT_NAME}" class="mb-4"></div>
            <div class="border rounded p-3" id="filterBar${this.PROJECT_NAME}"></div>
        `);

        $(`#container${this.PROJECT_NAME}`).prepend(`
            <div id="tableContainer${this.PROJECT_NAME}"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "zona",
                    lbl: "Departamento",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todas los departamentos" },
                        ...zones
                    ],
                    onchange: "existencias.renderExistencias()"
                },
                {
                    opc: "select",
                    id: "area",
                    lbl: "Área",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todas las áreas" },
                        ...areas
                    ],
                    onchange: "existencias.renderExistencias()"
                },
                {
                    opc: "select",
                    id: "categoria",
                    lbl: "Categoría",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todas las categorías" },
                        ...categories
                    ],
                    onchange: "existencias.renderExistencias()"
                },
                {
                    opc: "select",
                    id: "estatus",
                    lbl: "Estatus Stock",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todos" },
                        { id: "disponible", valor: "Disponible" },
                        { id: "bajo", valor: "Stock Bajo" },
                        { id: "agotado", valor: "Agotado" }
                    ],
                    onchange: "existencias.renderExistencias()"
                }
            ]
        });
    }

    renderExistencias() {
        this.showCards();
        this.lsExistencias();
    }

    async showCards() {
        const zona      = $(`#filterBar${this.PROJECT_NAME} #zona`).val();
        const area      = $(`#filterBar${this.PROJECT_NAME} #area`).val();
        const categoria = $(`#filterBar${this.PROJECT_NAME} #categoria`).val();
        const estatus   = $(`#filterBar${this.PROJECT_NAME} #estatus`).val();

        const response = await useFetch({
            url: this._link,
            data: {
                opc: "getResumenExistencias",
                zona: zona,
                area: area,
                categoria: categoria,
                estatus: estatus
            }
        });

        this.infoCards({
            parent: `summaryCards${this.PROJECT_NAME}`,
            cols: 5,
            json: [
                {
                    id: "cardTotalProductos",
                    title: "Total Productos",
                    data: {
                        value: response.totalProductos || 0,
                        color: "text-sky-500"
                    },
                    lucideIcon: "package"
                },
                {
                    id: "cardDisponibles",
                    title: "Disponibles",
                    data: {
                        value: response.disponibles || 0,
                        color: "text-emerald-500"
                    },
                    lucideIcon: "circle-check"
                },
                {
                    id: "cardStockBajo",
                    title: "Stock Bajo",
                    data: {
                        value: response.stockBajo || 0,
                        color: "text-amber-500"
                    },
                    lucideIcon: "triangle-alert"
                },
                {
                    id: "cardAgotados",
                    title: "Agotados",
                    data: {
                        value: response.agotados || 0,
                        color: "text-rose-500"
                    },
                    lucideIcon: "circle-x"
                },
                {
                    id: "cardValorTotal",
                    title: "Valor Inventario",
                    data: {
                        value: response.valorTotal || '$0.00',
                        color: "text-violet-500"
                    },
                    lucideIcon: "wallet"
                }
            ]
        });
    }

    lsExistencias() {
        this.createTable({
            parent: `tableContainer${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "lsExistencias" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: "light",
                striped: true,
                title: "📦 Reporte de Existencias",
                subtitle: "Inventario actual de productos",
                center: [ 2, 3,  5, 6, 7, 8, 9],
                right: [10, 11]
            }
        });
    }

    infoCards(options) {
        const defaults = {
            parent: "root",
            id: "infoCards",
            cols: 5, 
            class: "",
            theme: "light",
            json: [],
            onClick: () => { }
        };

        const opts = Object.assign({}, defaults, options);
        const isDark = opts.theme === "dark";

        const cardBase = isDark
            ? "bg-[#1F2A37] text-white rounded-lg border border-gray-700"
            : " text-gray-800 rounded-lg border";

        const titleColor = isDark ? "text-gray-300" : "text-gray-600";

        const cols = opts.cols || 4;
        const container = $("<div>", {
            id: opts.id,
            class: `grid grid-cols-1 md:grid-cols-${cols} gap-4 ${opts.class}`
        });

        let hasLucideIcons = false;

        opts.json.forEach(card => {
            let iconHtml = '';

            if (card.lucideIcon) {
                iconHtml = `<i data-lucide="${card.lucideIcon}" class="w-8 h-8"></i>`;
                hasLucideIcons = true;
            } else if (card.icon) {
                iconHtml = `<i class="${card.icon}"></i>`;
            } else {
                iconHtml = `<i class="icon-chart-line"></i>`;
            }

            const cardElement = $("<div>", {
                class: `${cardBase} p-4 hover:shadow-lg transition-shadow cursor-pointer`
            }).html(`
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm ${titleColor} mb-1">${card.title}</p>
                        <p id="${card.id || ''}" class="text-2xl font-bold ${card.data?.color || 'text-gray-800'}">${card.data?.value || '0'}</p>
                        ${card.data?.description ? `<p class="text-xs mt-1 ${card.data?.color || 'text-gray-500'}">${card.data.description}</p>` : ''}
                    </div>
                    <div class="text-3xl ${card.data?.color || 'text-gray-400'}">
                        ${iconHtml}
                    </div>
                </div>
            `);

            if (typeof opts.onClick === "function") {
                cardElement.on("click", () => opts.onClick(card));
            }

            container.append(cardElement);
        });

        $(`#${opts.parent}`).html(container);

        if (hasLucideIcons && typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    async solicitarProducto(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getProducto", id: id }
        });

        if (request.status === 200) {
            this.createModalForm({
                id: "formSolicitud",
                data: { opc: "addSolicitud", id_producto: id },
                bootbox: { title: "Solicitar Producto", closeButton: true },
                json: [
                    { opc: "label", text: `Producto: ${request.data.Equipo}`, class: "col-12 mb-2 fw-bold" },
                    { opc: "label", text: `Stock actual: ${request.data.cantidad}`, class: "col-12 mb-3" },
                    { opc: "input", id: "cantidad_solicitada", lbl: "Cantidad a solicitar", tipo: "numero", class: "col-12 mb-3", required: true },
                    { opc: "textarea", id: "observaciones", lbl: "Observaciones", class: "col-12 mb-3" }
                ],
                success: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, btn1: true });
                        this.renderExistencias();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
                }
            });
        }
    }
}
