class DailyReport extends AppReportes {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "ReportesDaily";
    }

    async render() {
        let params = appReportes.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsDailyTickets", ...params } });

        this.createCoffeeTable3({
            parent: 'container-daily',
            id: `tbReportesDaily`,
            theme: 'dark',
            title: 'Ticket Diario',
            subtitle: `Sucursal: ${appReportes.getSubName()}`,
            center: [2],
            right: [3, 4, 5, 6, 7],
            extends: true,
            scrollable: false,
            data: data,
        });

        if (data.totals) {
            appReportes.renderTotalsBar(data.totals, 'container-daily');
        }

        simple_data_table(`#tbReportesDaily`, 25);
    }
}
