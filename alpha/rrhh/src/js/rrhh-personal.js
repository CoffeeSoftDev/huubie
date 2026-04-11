let personal;

class Personal extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Personal";
    }

    render() {
        this.layoutPersonal();
        this.filterBarPersonal();
        this.showPersonalStats();
        this.lsPersonal();
    }

    layoutPersonal() {
        $('#container-personal').html('<div id="filterBarPersonal" class="mb-3"></div><div id="cardsPersonal" class="mb-3"></div><div id="containerPersonal"></div>');
    }

    filterBarPersonal() {
        this.createfilterBar({
            parent: 'filterBarPersonal',
            data: [
                {
                    opc: 'select',
                    id: 'personal_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-2',
                    onchange: 'personal.lsPersonal(); personal.showPersonalStats()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                },
                {
                    opc: 'select',
                    id: 'personal_estado',
                    lbl: 'Estado:',
                    class: 'col-12 col-md-2',
                    onchange: 'personal.lsPersonal()',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'activo', valor: 'Activo' },
                        { id: 'baja', valor: 'Baja' },
                        { id: 'suspendido', valor: 'Suspendido' }
                    ]
                },
                {
                    opc: 'select',
                    id: 'personal_puesto',
                    lbl: 'Puesto:',
                    class: 'col-12 col-md-2',
                    onchange: 'personal.lsPersonal()',
                    data: [
                        { id: '0', valor: 'Todos' },
                        ...this.puestos
                    ]
                },
                {
                    opc: 'select',
                    id: 'personal_turno',
                    lbl: 'Turno:',
                    class: 'col-12 col-md-2',
                    onchange: 'personal.lsPersonal()',
                    data: [
                        { id: '0', valor: 'Todos' },
                        ...this.turnos
                    ]
                },
                {
                    opc: 'button',
                    id: 'btnAddPersonal',
                    text: 'Nuevo Colaborador',
                    icon: 'icon-plus',
                    class: 'col-12 col-md-2',
                    className: 'w-full',
                    color_btn: 'primary',
                    onClick: () => this.addPersonal()
                }
            ]
        });
    }

    async showPersonalStats() {
        const req = await useFetch({
            url: this._link,
            data: {
                opc: 'showPersonal',
                subsidiaries_id: $('#personal_sub').val() || '0'
            }
        });

        if (req && req.status === 200 && req.counts) {
            this.infoCard({
                parent: 'cardsPersonal',
                theme: "dark",
                style: "file",
                cols: 4,
                class: "pt-1 pb-2",
                json: [
                    {
                        id: "kpiActivos",
                        title: "Activos",
                        bgColor: "bg-green-500/10",
                        borderColor: "border-green-500/30",
                        data: {
                            value: req.counts.activos || 0,
                            color: "text-green-400"
                        }
                    },
                    {
                        id: "kpiBajas",
                        title: "Bajas",
                        bgColor: "bg-red-500/10",
                        borderColor: "border-red-500/30",
                        data: {
                            value: req.counts.bajas || 0,
                            color: "text-red-400"
                        }
                    },
                    {
                        id: "kpiSuspendidos",
                        title: "Suspendidos",
                        bgColor: "bg-yellow-500/10",
                        borderColor: "border-yellow-500/30",
                        data: {
                            value: req.counts.suspendidos || 0,
                            color: "text-yellow-400"
                        }
                    },
                    {
                        id: "kpiTotal",
                        title: "Total",
                        bgColor: "bg-purple-500/10",
                        borderColor: "border-purple-500/30",
                        data: {
                            value: req.counts.total || 0,
                            color: "text-purple-400"
                        }
                    }
                ]
            });
        }
    }

    lsPersonal() {
        this.createTable({
            parent: 'containerPersonal',
            idFilterBar: 'filterBarPersonal',
            data: {
                opc: 'lsPersonal',
                subsidiaries_id: $('#personal_sub').val() || '0',
                estado: $('#personal_estado').val() || '',
                puesto_id: $('#personal_puesto').val() || '0',
                turno_id: $('#personal_turno').val() || '0'
            },
            conf: {
                datatable: true,
                pag: 15
            },
            coffeesoft: true,
            attr: {
                id: 'tbPersonal',
                theme: 'corporativo',
                title: 'Colaboradores',
                subtitle: '',
                center: [3, 4, 5, 7],
                right: [6]
            }
        });
    }

    addPersonal() {
        this.createModalForm({
            id: 'formPersonal',
            bootbox: {
                title: 'Nuevo Colaborador',
                size: 'large',
                closeButton: true
            },
            data: { opc: 'addPersonal' },
            autofill: false,
            json: this.jsonPersonal(),
            success: (response) => {
                if (response.status == 200) {
                    this.closedModal(response);
                    this.lsPersonal();
                    this.showPersonalStats();
                    alert({
                        icon: "success",
                        title: "Registrado",
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

    async editPersonal(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: 'getPersonal', id: id }
        });

        if (request.status !== 200) {
            alert({
                icon: "error",
                text: "No se encontro el registro",
                btn1: true,
                btn1Text: "Ok"
            });
            return;
        }

        this.createModalForm({
            id: 'formPersonal',
            bootbox: {
                title: 'Editar Colaborador',
                size: 'large',
                closeButton: true
            },
            data: { opc: 'editPersonal', id: id },
            autofill: request.data,
            json: this.jsonPersonal(),
            success: (response) => {
                if (response.status == 200) {
                    this.closedModal(response);
                    this.lsPersonal();
                    this.showPersonalStats();
                    alert({
                        icon: "success",
                        title: "Actualizado",
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

    jsonPersonal() {
        return [
            {
                opc: 'label',
                id: 'lblDatos',
                text: 'Datos personales',
                class: 'col-12 fw-bold text-lg mb-2 p-1'
            },
            {
                opc: 'input',
                lbl: 'Nombre:',
                id: 'nombre',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'input',
                lbl: 'Apellido Paterno:',
                id: 'apellido_paterno',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'input',
                lbl: 'Apellido Materno:',
                id: 'apellido_materno',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'Email:',
                id: 'email',
                tipo: 'email',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'Telefono:',
                id: 'telefono',
                tipo: 'tel',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'Fecha Nacimiento:',
                id: 'fecha_nacimiento',
                type: 'date',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'CURP:',
                id: 'curp',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'RFC:',
                id: 'rfc',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'NSS:',
                id: 'nss',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'label',
                id: 'lblLaboral',
                text: 'Datos laborales',
                class: 'col-12 fw-bold text-lg mb-2 p-1'
            },
            {
                opc: 'select',
                lbl: 'Puesto:',
                id: 'puesto_id',
                class: 'col-12 col-md-4 mb-3',
                data: this.puestos
            },
            {
                opc: 'select',
                lbl: 'Turno:',
                id: 'turno_id',
                class: 'col-12 col-md-4 mb-3',
                data: this.turnos
            },
            {
                opc: 'select',
                lbl: 'Sucursal:',
                id: 'subsidiaries_id',
                class: 'col-12 col-md-4 mb-3',
                data: this.subsidiaries
            },
            {
                opc: 'select',
                lbl: 'Tipo Contrato:',
                id: 'tipo_contrato',
                class: 'col-12 col-md-4 mb-3',
                data: [
                    { id: 'indefinido', valor: 'Indefinido' },
                    { id: 'temporal', valor: 'Temporal' },
                    { id: 'honorarios', valor: 'Honorarios' },
                    { id: 'eventual', valor: 'Eventual' }
                ]
            },
            {
                opc: 'input',
                lbl: 'Fecha Ingreso:',
                id: 'fecha_ingreso',
                type: 'date',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'input',
                lbl: 'Salario Diario:',
                id: 'salario_diario',
                tipo: 'cifra',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'select',
                lbl: 'Frecuencia Pago:',
                id: 'frecuencia_pago',
                class: 'col-12 col-md-4 mb-3',
                data: [
                    { id: 'semanal', valor: 'Semanal' },
                    { id: 'catorcenal', valor: 'Catorcenal' },
                    { id: 'quincenal', valor: 'Quincenal' },
                    { id: 'mensual', valor: 'Mensual' }
                ]
            },
            {
                opc: 'input',
                lbl: 'Cuenta Bancaria:',
                id: 'cuenta_bancaria',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                lbl: 'Banco:',
                id: 'banco',
                tipo: 'texto',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'textarea',
                lbl: 'Notas:',
                id: 'notas',
                class: 'col-12 mb-3',
                rows: 3,
                required: false
            }
        ];
    }

    deletePersonal(id) {
        this.swalQuestion({
            opts: {
                title: 'Dar de baja',
                html: 'Se cambiara el estado del colaborador a <strong>Baja</strong>.'
            },
            data: {
                opc: 'statusPersonal',
                id: id,
                estado: 'baja'
            },
            methods: {
                request: () => {
                    this.lsPersonal();
                    this.showPersonalStats();
                    alert({
                        icon: "success",
                        title: "Actualizado",
                        text: "Estado actualizado correctamente",
                        btn1: true
                    });
                }
            }
        });
    }
}

$(function () {
    personal = new Personal(api, 'root');
});
