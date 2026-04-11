let nomina;

class Nomina extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Nomina";
    }

    render() {
        this.layoutNomina();
        this.filterBarNomina();
        this.lsNomina();
    }

    layoutNomina() {
        $('#container-nomina').html('<div id="filterBarNomina" class="mb-3"></div><div id="cardsNomina" class="mb-3"></div><div id="containerNomina"></div>');
    }

    filterBarNomina() {
        this.createfilterBar({
            parent: 'filterBarNomina',
            data: [
                {
                    opc: 'select',
                    id: 'nomina_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-2',
                    onchange: 'nomina.lsNomina()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                },
                {
                    opc: 'button',
                    id: 'btnAddNomina',
                    text: 'Nuevo Periodo',
                    icon: 'icon-plus',
                    class: 'col-12 col-md-2',
                    className: 'w-full',
                    color_btn: 'primary',
                    onClick: () => this.addNominaPeriodo()
                }
            ]
        });
    }

    lsNomina() {
        this.createTable({
            parent: 'containerNomina',
            idFilterBar: 'filterBarNomina',
            data: {
                opc: 'lsNomina',
                subsidiaries_id: $('#nomina_sub').val() || '0'
            },
            conf: {
                datatable: true,
                pag: 15
            },
            coffeesoft: true,
            attr: {
                id: 'tbNomina',
                theme: 'corporativo',
                title: 'Periodos de Nomina',
                subtitle: '',
                center: [4, 6],
                right: [5]
            }
        });
    }

    addNominaPeriodo() {
        this.createModalForm({
            id: 'formNomina',
            bootbox: {
                title: 'Nuevo Periodo de Nomina',
                closeButton: true
            },
            data: {
                opc: 'addNomina',
                companies_id: 1
            },
            autofill: false,
            json: [
                {
                    opc: 'select',
                    lbl: 'Sucursal:',
                    id: 'subsidiaries_id',
                    class: 'col-12 mb-3',
                    data: this.subsidiaries
                },
                {
                    opc: 'select',
                    lbl: 'Frecuencia:',
                    id: 'frecuencia',
                    class: 'col-12 col-md-6 mb-3',
                    data: [
                        { id: 'semanal', valor: 'Semanal' },
                        { id: 'catorcenal', valor: 'Catorcenal' },
                        { id: 'quincenal', valor: 'Quincenal' },
                        { id: 'mensual', valor: 'Mensual' }
                    ]
                },
                {
                    opc: 'input',
                    lbl: 'Fecha Inicio:',
                    id: 'fecha_inicio',
                    type: 'date',
                    class: 'col-12 col-md-6 mb-3'
                },
                {
                    opc: 'input',
                    lbl: 'Fecha Fin:',
                    id: 'fecha_fin',
                    type: 'date',
                    class: 'col-12 col-md-6 mb-3'
                }
            ],
            success: (response) => {
                if (response.status == 200) {
                    this.closedModal(response);
                    this.lsNomina();
                    alert({
                        icon: "success",
                        title: "Calculada",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async verNominaDetalle(periodoId) {
        const req = await useFetch({
            url: this._link,
            data: {
                opc: 'showNomina',
                periodo_id: periodoId
            }
        });

        if (req && req.status === 200) {
            $('#containerNomina').html('<div id="nominaBack" class="mb-3"></div><div id="cardsNominaDetalle" class="mb-3"></div><div id="tbNominaDetalle"></div>');

            $('#nominaBack').html('<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors" onclick="nomina.lsNomina()"><i class="icon-left-open"></i> Volver</button>');

            this.infoCard({
                parent: 'cardsNominaDetalle',
                theme: "dark",
                style: "file",
                cols: 4,
                class: "pt-1 pb-2",
                json: [
                    {
                        id: "kpiEfectivo",
                        title: "Total Efectivo",
                        bgColor: "bg-green-500/10",
                        borderColor: "border-green-500/30",
                        data: {
                            value: formatPrice(parseFloat(req.totals.total_efectivo || 0)),
                            color: "text-green-400"
                        }
                    },
                    {
                        id: "kpiBancos",
                        title: "Total Bancos",
                        bgColor: "bg-blue-500/10",
                        borderColor: "border-blue-500/30",
                        data: {
                            value: formatPrice(parseFloat(req.totals.total_bancos || 0)),
                            color: "text-blue-400"
                        }
                    },
                    {
                        id: "kpiGeneral",
                        title: "Total General",
                        bgColor: "bg-purple-500/10",
                        borderColor: "border-purple-500/30",
                        data: {
                            value: formatPrice(parseFloat(req.totals.total_general || 0)),
                            color: "text-purple-400"
                        }
                    },
                    {
                        id: "kpiColaboradores",
                        title: "Colaboradores",
                        bgColor: "bg-gray-500/10",
                        borderColor: "border-gray-500/30",
                        data: {
                            value: req.totals.total_colaboradores || 0,
                            color: "text-gray-400"
                        }
                    }
                ]
            });

            this.createCoffeTable({
                parent: 'tbNominaDetalle',
                id: 'tbNominaDetalleTable',
                theme: 'dark',
                title: 'Detalle de Nomina',
                data: {
                    row: req.row || []
                },
                center: [4, 5],
                right: [6, 7, 8, 9, 10]
            });
        }
    }

    aprobarNomina(periodoId) {
        app.modalAutorizacion('aprobar_nomina', 'rrhh_nomina_periodos', periodoId, async () => {
            const req = await useFetch({
                url: this._link,
                data: {
                    opc: 'editNomina',
                    id: periodoId,
                    estatus: 'aprobada',
                    aprobado_por: this.usr,
                    aprobado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
            if (req.status === 200) {
                this.lsNomina();
                alert({
                    icon: "success",
                    title: "Aprobada",
                    text: "Nomina aprobada correctamente",
                    btn1: true
                });
            }
        });
    }
}

$(function () {
    nomina = new Nomina(api, 'root');
});
