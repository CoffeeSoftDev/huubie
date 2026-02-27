
class Movimientos extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "movimientos";
    }

    render() {
        this.layout();
        this.filterBar();
      
    }

    layout() {
        this.primaryLayout({
            parent: "container-movimientos",
            id: this.PROJECT_NAME,
            class: "w-full p-3",
            card: {
                filterBar: { class: "w-full mb-3", id: `containerFilterBar${this.PROJECT_NAME}` },
                container: { class: "w-full h-full", id: `container${this.PROJECT_NAME}` }
            }
        });

        $(`#containerFilterBar${this.PROJECT_NAME}`).prepend(`
            <div id="summaryCards${this.PROJECT_NAME}" class="mb-4"></div>
            <div class="border rounded p-3" id="filterBar${this.PROJECT_NAME}" class="mb-4"></div>
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
                    id: "mes",
                    lbl: "Mes",
                    class: "col-12 col-md-2",
                    data: meses,
                    onchange: "movimientos.renderMovimiento()"
                },
                {
                    opc: "select",
                    id: "anio",
                    lbl: "Año",
                    class: "col-12 col-md-2",
                    data: anios,
                    onchange: "movimientos.renderMovimiento()"
                },
                {
                    opc: "select",
                    id: "zona",
                    lbl: "Zona",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todas las zonas" },
                        ...zonas
                    ],
                    onchange: "movimientos.renderMovimiento()"
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
                    onchange: "movimientos.renderMovimiento()"
                },
                {
                    opc: "select",
                    id: "categoria",
                    lbl: "Categoría",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "Todos", valor: "Todas las categorías" },
                        ...categorias
                    ],
                    onchange: "movimientos.renderMovimiento()"
                }
            ]
        });

        const mesActual = moment().month() + 1;
        
        setTimeout(() => {
            $(`#filterBar${this.PROJECT_NAME} #mes`).val(mesActual).trigger("change");
        }, 100);
    }

    renderMovimiento(){
        this.showCards()
        this.lsMovimientos()
    }

    async showCards() {

        const mes       = $(`#filterBar${this.PROJECT_NAME} #mes`).val();
        const anio      = $(`#filterBar${this.PROJECT_NAME} #anio`).val();
        const zona      = $(`#filterBar${this.PROJECT_NAME} #zona`).val();
        const area      = $(`#filterBar${this.PROJECT_NAME} #area`).val();
        const categoria = $(`#filterBar${this.PROJECT_NAME} #categoria`).val();


        const response = await useFetch({
            url: this._link,
            data: {
                opc: "getResumen",
                mes: mes,
                anio: anio,
                zona: zona,
                area: area,
                categoria: categoria
            }
        });



        this.infoCards({
            parent: `summaryCards${this.PROJECT_NAME}`,
            json: [
                {
                    id: "cardTotal",
                    title: "Total Movimientos",
                    data: {
                        value: response.total,
                        color: "text-blue-600"
                    },
                    lucideIcon: "package"
                },
                {
                    id: "cardEntradas",
                    title: "Entradas",
                    lucideIcon: "trending-up",
                 
                    data: {
                        value: response.entradas,
                        color: "text-green-600"
                    }
                },
                {
                    id: "cardSalidas",
                    title: "Salidas",
                    data: {
                        value: response.salidas,
                        color: "text-red-600"
                    },
                    lucideIcon: "trending-down"
                },
                // {
                //     id: "cardBalance",
                //     title: "Balance",
                //     data: {
                //         // value: balanceSign + balance,
                //         // color: balanceColor
                //     },
                //     lucideIcon: "activity"
                // }
            ]

        });
    }

    async lsMovimientos() {
      

        this.createTable({
            parent: `tableContainer${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: "lsProducts",
              
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: "light",
                striped:true,
                title: "Historial de Movimientos",
                subtitle: "Mostrando movimientos por categoría",
                center: [1, 2, 3, 5, 6, 7,8]
            }
        });
    }


    async renderCards(){
        const mes       = $(`#filterBar${this.PROJECT_NAME} #mes`).val();
        const anio      = $(`#filterBar${this.PROJECT_NAME} #anio`).val();
        const zona      = $(`#filterBar${this.PROJECT_NAME} #zona`).val();
        const area      = $(`#filterBar${this.PROJECT_NAME} #area`).val();
        const categoria = $(`#filterBar${this.PROJECT_NAME} #categoria`).val();

        try {
            const response = await useFetch({
                url: this._link,
                data: {
                    opc: "lsMovimientos",
                    mes: mes,
                    anio: anio,
                    zona: zona,
                    area: area,
                    categoria: categoria
                }
            });

            if (response.resumen) {
                $("#cardTotal").text(response.resumen.total);
                $("#cardEntradas").text(response.resumen.entradas);
                $("#cardSalidas").text(response.resumen.salidas);

                const balance = response.resumen.balance;
                const balanceColor = balance >= 0 ? "text-green-600" : "text-red-600";
                const balanceSign = balance >= 0 ? "+" : "";

                $("#cardBalance")
                    .text(balanceSign + balance)
                    .removeClass("text-green-600 text-red-600 text-purple-600")
                    .addClass(balanceColor);
            }
        } catch (error) {
            console.error('Error al cargar movimientos:', error);
            alert({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudieron cargar los movimientos. Intente nuevamente.'
            });

            $("#cardTotal").text("0");
            $("#cardEntradas").text("0");
            $("#cardSalidas").text("0");
            $("#cardBalance").text("0").removeClass("text-green-600 text-red-600").addClass("text-gray-600");
            return;
        }
    }

    // Componente.
    infoCards(options) {
        const defaults = {
            parent: "root",
            id: "infoCards",
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

        const container = $("<div>", {
            id: opts.id,
            class: `grid grid-cols-2 md:grid-cols-4 gap-4 ${opts.class}`
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
}
