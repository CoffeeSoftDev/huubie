let api = 'ctrl/ctrl-reportes.php';
let appReportes;
let lsSucursales = [];

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });

    if (data.status === 403) {
        alert({ icon: "error", title: "Sin permisos", text: "No tienes permisos para acceder a esta sección.", btn1: true, btn1Text: "Aceptar" });
        return;
    }

    lsSucursales = data.subsidiaries || [];
    appReportes = new AppReportes(api, 'root');
    appReportes.render();
});

class AppReportes extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Reportes";
        this.currentTab = 'tickets';
    }

    render() {
        this.layout();
        this.createFilterBar();
        this.lsTickets();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 p-2',
            heightPreset: 'viewport',
            card: {
                filterBar: { class: 'w-full', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-2 bg-[#1F2A37] rounded p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            json: [
                {
                    id: "tickets",
                    tab: "Detalle de Tickets",
                    active: true,
                    onClick: () => {
                        this.currentTab = 'tickets';
                        this.lsTickets();
                    }
                },
                {
                    id: "turnos",
                    tab: "Turnos",
                    onClick: () => {
                        this.currentTab = 'turnos';
                        this.lsShifts();
                    }
                },
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }

    createFilterBar() {
        let filterData = [
            {
                opc: "select",
                id: "sub_id",
                lbl: "Sucursal:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "appReportes.refreshCurrentTab()",
                data: [
                    { id: "0", valor: "Todas las sucursales" },
                    ...lsSucursales
                ]
            },
            {
                opc: "input-calendar",
                class: "col-12 col-md-3 col-lg-2",
                id: "calendar" + this.PROJECT_NAME,
                lbl: "Consultar fecha: ",
            },
            {
                opc: "button",
                class: "col-12 col-md-2 col-lg-1",
                color_btn: "primary",
                id: "btnBuscar",
                text: "Buscar",
                className: 'w-full',
                icono: "icon-search",
                onClick: () => this.refreshCurrentTab()
            },
        ];

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: filterData,
        });

        dataPicker({
            parent: "calendar" + this.PROJECT_NAME,
            onSelect: () => this.refreshCurrentTab(),
        });
    }

    refreshCurrentTab() {
        if (this.currentTab === 'tickets') {
            this.lsTickets();
        } else {
            this.lsShifts();
        }
    }

    getFilterParams() {
        let rangePicker = getDataRangePicker("calendar" + this.PROJECT_NAME);
        let sub_id = $(`#filterBar${this.PROJECT_NAME} #sub_id`).val() || '0';

        if (sub_id === '0' && lsSucursales.length > 0) {
            sub_id = lsSucursales[0].id;
        }

        return {
            fi: rangePicker.fi,
            ff: rangePicker.ff,
            sub_id: sub_id
        };
    }

    lsTickets() {
        let params = this.getFilterParams();

        this.createTable({
            parent: `container-tickets`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "lsTickets", ...params },
            conf: { datatable: true, pag: 25 },
            coffeesoft: true,
            attr: {
                id: `tb${this.PROJECT_NAME}Tickets`,
                theme: 'shadcdn',
                title: 'Detalle de Tickets',
                subtitle: '',
                center: [3, 4],
                right: [5, 6, 7, 8, 9, 10],
                extends: true,
            },
            success: (data) => {
                if (data.totals) {
                    this.renderTotalsBar(data.totals);
                }
            }
        });
    }

    renderTotalsBar(totals) {
        let existingBar = $(`#totalsBar${this.PROJECT_NAME}`);
        if (existingBar.length) existingBar.remove();

        let html = `
            <div id="totalsBar${this.PROJECT_NAME}" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4 mt-3">
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Total Tickets</p>
                    <p class="text-lg font-bold text-white">${totals.total_tickets}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Importe Total</p>
                    <p class="text-lg font-bold text-green-400">${totals.importe}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Efectivo</p>
                    <p class="text-lg font-bold text-blue-400">${totals.efectivo}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Tarjeta</p>
                    <p class="text-lg font-bold text-purple-400">${totals.tarjeta}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Transferencia</p>
                    <p class="text-lg font-bold text-yellow-400">${totals.transferencia}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Propinas</p>
                    <p class="text-lg font-bold text-teal-400">${totals.propina}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Descuentos</p>
                    <p class="text-lg font-bold text-red-400">${totals.descuento}</p>
                </div>
            </div>
        `;

        $(`#container-tickets`).prepend(html);
    }

    lsShifts() {
        let params = this.getFilterParams();

        this.createTable({
            parent: `container-turnos`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "lsShifts", ...params },
            conf: { datatable: true, pag: 15 },
            coffeesoft: true,
            attr: {
                id: `tb${this.PROJECT_NAME}Shifts`,
                theme: 'shadcdn',
                title: 'Historial de Turnos',
                subtitle: '',
                center: [10, 12],
                right: [4, 5, 6, 7, 8, 9, 11],
                extends: true,
            },
        });
    }

    async showShiftDetail(id) {
        const data = await useFetch({ url: this._link, data: { opc: "showShiftDetail", id } });

        if (data.status !== 200) {
            alert({ icon: "error", text: data.message, btn1: true, btn1Text: "Aceptar" });
            return;
        }

        const s = data.shift;
        const openDate = s.opened_at ? new Date(s.opened_at).toLocaleString('es-MX') : '-';
        const closeDate = s.closed_at ? new Date(s.closed_at).toLocaleString('es-MX') : 'Abierto';

        let content = `
            <div class="p-3">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div class="bg-[#283341] p-3 rounded-lg">
                        <p class="text-xs text-gray-400">Cajero</p>
                        <p class="text-sm font-bold text-white">${s.employee_name || 'Sin asignar'}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg">
                        <p class="text-xs text-gray-400">Apertura</p>
                        <p class="text-sm font-bold text-white">${openDate}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg">
                        <p class="text-xs text-gray-400">Cierre</p>
                        <p class="text-sm font-bold text-white">${closeDate}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg">
                        <p class="text-xs text-gray-400">Folio Z</p>
                        <p class="text-sm font-bold text-white">${s.folio_z || '-'}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400">Total Ventas</p>
                        <p class="text-lg font-bold text-green-400">$${parseFloat(s.total_sales || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400">Efectivo</p>
                        <p class="text-lg font-bold text-blue-400">$${parseFloat(s.total_cash || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400">Tarjeta</p>
                        <p class="text-lg font-bold text-purple-400">$${parseFloat(s.total_card || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400">Transferencia</p>
                        <p class="text-lg font-bold text-yellow-400">$${parseFloat(s.total_transfer || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400">Propinas</p>
                        <p class="text-lg font-bold text-teal-400">$${parseFloat(s.total_tips || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400">Pedidos</p>
                        <p class="text-lg font-bold text-white">${s.total_orders || 0}</p>
                    </div>
                </div>

                <div id="shiftTicketsTable"></div>
            </div>
        `;

        bootbox.dialog({
            title: `Detalle del Turno #${s.id}`,
            message: content,
            size: 'extra-large',
            className: 'bg-[#1F2A37]',
            onShown: () => {
                if (data.tickets && data.tickets.length > 0) {
                    this.createCoffeTable({
                        parent: "shiftTicketsTable",
                        id: "tbShiftTickets",
                        theme: "dark",
                        data: {
                            thead: ["Folio", "Fecha", "Cuenta", "Descuento", "Propina", "Importe", "Efectivo", "Tarjeta", "Transf."],
                            row: data.tickets
                        }
                    });
                } else {
                    $('#shiftTicketsTable').html(`
                        <div class="text-center py-8 text-gray-400">
                            <p>No hay tickets asociados a este turno</p>
                        </div>
                    `);
                }
            }
        });
    }
}
