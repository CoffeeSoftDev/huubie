let reports;

$(async () => {
    reports = new OrderReports(api, "root");
});

class OrderReports extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderReports";
    }

    render() {
        this.layout();
    }

    layout() {
        this.primaryLayout({
            parent: "container-reportes",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full border-b pb-3", id: "filterBar" + this.PROJECT_NAME },
                container: { class: "w-full h-full", id: "container" + this.PROJECT_NAME },
            },
        });

        $(`#filterBar${this.PROJECT_NAME}`).prepend(`
            <div class="px-4 pt-3 pb-3">
                <h2 class="text-2xl font-semibold text-white">📊 Reportes de Cierre</h2>
                <p class="text-gray-400">Consulta el corte de cierre por sucursal y fecha.</p>
            </div>
        `);

        $(`#container${this.PROJECT_NAME}`).html(`<div id="container-cierre"></div>`);

        this.renderCierreReport();
    }

    // Reporte de Cierre: SOLO CONSULTA. Reutiliza el endpoint getCierre y el render
    // del Corte Z de la clase Cierre (pedidos-cierre.js), sin exponer ninguna accion
    // de cerrar dia ni abrir/cerrar turno. Cada tab de cierre trae su propio filtro
    // de sucursal + fecha (un cierre es de un dia puntual).
    renderCierreReport() {
        const sucursalOptions = (lsSucursales || [])
            .map(s => `<option value="${s.id}">${s.valor}</option>`)
            .join('');
        const hoy = moment().format('YYYY-MM-DD');

        $('#container-cierre').html(`
            <div class="p-4">
                <div class="flex flex-col md:flex-row md:items-end gap-3 mb-4">
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Sucursal</label>
                        <select id="cierreSucursal" class="bg-[#1F2A37] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm min-w-[200px]">
                            ${sucursalOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Fecha del cierre</label>
                        <input type="date" id="cierreFecha" value="${hoy}" class="bg-[#1F2A37] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <button id="btnConsultarCierre" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg" onclick="reports.loadCierreReport()">
                        <i class="icon-search"></i> Consultar
                    </button>
                    <button id="btnImprimirCierre" class="hidden bg-[#2a3441] hover:bg-[#333f4f] text-gray-200 text-sm font-semibold px-4 py-2 rounded-lg" onclick="cierre.printDaily()">
                        <i class="icon-print"></i> Imprimir
                    </button>
                </div>
                <div id="ticketContainerReporte"></div>
            </div>
        `);

        this.loadCierreReport();
    }

    async loadCierreReport() {
        const date            = $('#cierreFecha').val();
        const subsidiaries_id = $('#cierreSucursal').val();

        if (!date) {
            $('#ticketContainerReporte').html('<p class="text-center text-gray-400 py-10">Selecciona una fecha.</p>');
            return;
        }

        $('#btnImprimirCierre').addClass('hidden');
        $('#ticketContainerReporte').html(`
            <div class="text-center text-gray-400 py-16">
                <div class="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Consultando cierre...</p>
            </div>
        `);

        const res = await useFetch({ url: apiCierre, data: { opc: 'getCierre', date, subsidiaries_id } });

        if (res.status !== 200 || !res.closure) {
            $('#ticketContainerReporte').html(`
                <div class="text-center py-16 text-gray-400">
                    <i class="icon-doc-text text-4xl mb-2 block"></i>
                    <p>${res.message || 'No hay cierre registrado para esta fecha y sucursal.'}</p>
                </div>
            `);
            return;
        }

        // Reutiliza el render del Corte Z de la clase Cierre, apuntado a nuestro contenedor.
        cierre.renderExecutiveSummary(res, 'ticketContainerReporte');
        $('#btnImprimirCierre').removeClass('hidden');
    }
}
