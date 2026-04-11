let resumen;

class Resumen extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Resumen";
    }

    render() {
        this.layoutResumen();
        this.filterBarResumen();
        this.showResumen();
    }

    layoutResumen() {
        $('#container-resumen').html('<div id="filterBarResumen" class="mb-4"></div><div id="cardsResumen" class="mb-4"></div><div id="chartResumen" class="mb-4"></div><div id="tableResumenPermisos"></div><div id="kpisNominaResumen"></div>');
    }

    filterBarResumen() {
        this.createfilterBar({
            parent: 'filterBarResumen',
            data: [
                {
                    opc: 'select',
                    id: 'resumen_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-3',
                    onchange: 'resumen.showResumen()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                }
            ]
        });
    }

    async showResumen() {
        const req = await useFetch({
            url: this._link,
            data: {
                opc: 'showResumen',
                subsidiaries_id: $('#resumen_sub').val() || this.selectedSub
            }
        });

        if (req && req.status === 200) {
            this.renderInfoCards(req.counts);
            this.renderChart(req.counts);
            this.renderPermisosTable(req.permisos);
        }
    }

    renderInfoCards(counts) {
        this.infoCard({
            parent: 'cardsResumen',
            theme: "dark",
            style: "file",
            cols: 5,
            class: "pt-2 pb-3",
            json: [
                {
                    id: "kpiAltas",
                    title: "Altas",
                    bgColor: "bg-green-500/10",
                    borderColor: "border-green-500/30",
                    data: {
                        value: counts.altas_periodo || 0,
                        color: "text-green-400"
                    }
                },
                {
                    id: "kpiBajas",
                    title: "Bajas",
                    bgColor: "bg-red-500/10",
                    borderColor: "border-red-500/30",
                    data: {
                        value: counts.bajas_periodo || 0,
                        color: "text-red-400"
                    }
                },
                {
                    id: "kpiActivos",
                    title: "Activos",
                    bgColor: "bg-blue-500/10",
                    borderColor: "border-blue-500/30",
                    data: {
                        value: counts.activos || 0,
                        color: "text-blue-400"
                    }
                },
                {
                    id: "kpiTotal",
                    title: "Total Registrados",
                    bgColor: "bg-purple-500/10",
                    borderColor: "border-purple-500/30",
                    data: {
                        value: counts.total_empleados || 0,
                        color: "text-purple-400"
                    }
                },
                {
                    id: "kpiBajasTotal",
                    title: "Bajas Totales",
                    bgColor: "bg-gray-500/10",
                    borderColor: "border-gray-500/30",
                    data: {
                        value: counts.bajas || 0,
                        color: "text-gray-400"
                    }
                }
            ]
        });
    }

    renderChart(counts) {
        $('#chartResumen').html('<div class="bg-[#1F2A37] border border-gray-700/60 rounded-xl p-5"><div class="flex items-start justify-between mb-4"><div><p class="text-xs text-gray-500 uppercase tracking-wider">Plantilla</p><div class="flex items-baseline gap-2"><h2 class="text-2xl font-bold text-white">' + (counts.total_empleados || 0) + '</h2><p class="text-[11px] text-gray-500">Empleados registrados</p></div></div></div><div style="height:260px"><canvas id="canvasResumen"></canvas></div></div>');

        const ctx = document.getElementById('canvasResumen');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Activos', 'Bajas', 'Altas Periodo', 'Bajas Periodo'],
                    datasets: [{
                        label: 'Empleados',
                        data: [
                            counts.activos || 0,
                            counts.bajas || 0,
                            counts.altas_periodo || 0,
                            counts.bajas_periodo || 0
                        ],
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124,58,237,0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#7c3aed',
                        pointBorderColor: '#7c3aed',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(55,65,81,0.3)' },
                            ticks: { color: '#6b7280', font: { size: 10 } }
                        },
                        y: {
                            grid: { color: 'rgba(55,65,81,0.3)' },
                            ticks: { color: '#6b7280', font: { size: 10 } },
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    renderPermisosTable(permisos) {
        if (!permisos || !permisos.row || permisos.row.length === 0) {
            $('#tableResumenPermisos').html('');
            return;
        }

        this.createCoffeTable({
            parent: 'tableResumenPermisos',
            id: 'tbResumenPermisos',
            theme: 'dark',
            title: 'Permisos Pendientes',
            data: permisos,
            center: [4, 5, 6]
        });
    }
}

