const SAMPLE_FOLIOS = [
    {
        id: 1,
        Folio: { html: "<span class='font-semibold text-gray-200'>#1</span>" },
        'Creación': '2026-06-20 10:30 AM',
        Cliente: { html: "<p class='text-gray-300'>Cliente demo</p><p class='text-gray-500 text-[11px]'>555-000-0000</p>" },
        Total: { html: '1,250.00', class: 'text-end bg-[#283341]' },
        Estado: 'Cotización',
        Sucursal: { html: "<span class='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#5b1e1e] text-red-200'>Sin sucursal</span>", class: 'text-center' },
        'Acción': { html: "<button class='px-2 py-1 rounded-md bg-purple-600 text-white text-[11px]'>Mover</button>", class: 'text-center' }
    }
];

let api = 'ctrl/ctrl-admin-folios.php';
let adminFolios;
let subsidiaries = [];
let statusList = [];

$(async () => {
    const req    = await useFetch({ url: api, data: { opc: 'init' } });
    subsidiaries = req.sucursales || [];
    statusList   = req.status || [];

    adminFolios = new AdminFolios(api, 'root');
    adminFolios.sinSucursal = req.sin_sucursal || 0;
    adminFolios.render();
});

class AdminFolios extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'AdminFolios';
        this.sinSucursal = 0;
    }

    render() {
        this.layout();
        this.createFilterBar();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 "></div>
            <div id="containerHours"></div>
        `);
    }

    createFilterBar() {
        let filterBar = [
            {
                opc: 'select',
                id: 'subsidiaryFilter',
                lbl: 'Filtrar por sucursal:',
                class: 'col-12 col-md-3 col-lg-2',
                onchange: 'adminFolios.ls()',
                data: [
                    { id: '0', valor: 'Todas las sucursales' },
                    { id: 'null', valor: '— Sin sucursal —' },
                    ...subsidiaries
                ]
            },
            {
                opc: 'input-calendar',
                id: 'calendar',
                lbl: 'Rango de fechas:',
                class: 'col-12 col-md-3 col-lg-2'
            },
            {
                opc: 'select',
                id: 'statusFilter',
                lbl: 'Estado:',
                class: 'col-12 col-md-3 col-lg-2',
                onchange: 'adminFolios.ls()',
                data: [
                    { id: '0', valor: 'Todos los estados' },
                    ...statusList
                ]
            },
            {
                opc: 'button',
                id: 'btnSinSucursal',
                class: 'col-6 col-md-3 col-lg-2',
                text: `Sin sucursal (${this.sinSucursal})`,
                icon: 'icon-attention',
                className: 'btn-warning w-100',
                onClick: () => this.filterWithout()
            }
        ];

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: filterBar
        });

        dataPicker({
            parent: 'calendar',
            rangepicker: {
                startDate: moment().startOf('month'),
                endDate: moment().endOf('month'),
                showDropdowns: true,
                ranges: {
                    'Hoy': [moment(), moment()],
                    'Ayer': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Semana actual': [moment().startOf('week'), moment().endOf('week')],
                    'Mes actual': [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                }
            },
            onSelect: () => this.ls()
        });
    }

    ls() {
        let range = getDataRangePicker('calendar');
        let subVal = $('#subsidiaryFilter').val();
        let onlyWithout = subVal === 'null' ? 1 : 0;

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: 'lsFolios',
                fi: range.fi,
                ff: range.ff,
                subsidiaries_id: onlyWithout ? '0' : subVal,
                only_without: onlyWithout,
                status: $('#statusFilter').val()
            },
            conf: { datatable: true, pag: 10, fn_datatable: 'simple_data_table_filter' },
            coffeesoft: true,
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'dark',
                center: [2, 4, 5, 6, 7],
                extends: true,
                f_size: 12
            }
        });
    }

    filterWithout() {
        $('#subsidiaryFilter').val('null');
        this.ls();
    }

    async refreshCount() {
        const req = await useFetch({ url: api, data: { opc: 'init' } });
        this.sinSucursal = req.sin_sucursal || 0;
        $('#btnSinSucursal').html(`<i class="icon-attention"></i> Sin sucursal (${this.sinSucursal})`);
    }

    async move(id) {
        const inputOptions = {};
        subsidiaries.forEach(s => { inputOptions[s.id] = s.valor; });
        inputOptions['null'] = '— Sin sucursal —';

        const { value, isConfirmed } = await Swal.fire({
            title: `Mover folio #${id}`,
            text: 'Selecciona la sucursal de destino',
            input: 'select',
            inputOptions: inputOptions,
            inputPlaceholder: 'Selecciona una sucursal',
            showCancelButton: true,
            confirmButtonText: 'Mover folio',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#8b5cf6',
            background: '#1F2A37',
            color: '#fff',
            inputValidator: (v) => (!v ? 'Debes seleccionar una opción' : undefined)
        });

        if (!isConfirmed) return;

        const response = await useFetch({
            url: api,
            data: { opc: 'moveFolio', id: id, subsidiaries_id: value }
        });

        if (response.status === 200) {
            alert({ icon: 'success', title: 'Listo', text: response.message, timer: 2000 });
            await this.refreshCount();
            this.ls();
        } else {
            alert({ icon: 'error', title: 'Error', text: response.message, btn1: true });
        }
    }
}
