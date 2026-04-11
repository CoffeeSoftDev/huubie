let permisos;

class Permisos extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Permisos";
    }

    render() {
        this.layoutPermisos();
        this.filterBarPermisos();
        this.lsPermisos();
    }

    layoutPermisos() {
        $('#container-permisos').html('<div id="filterBarPermisos" class="mb-3"></div><div id="containerPermisos"></div>');
    }

    filterBarPermisos() {
        this.createfilterBar({
            parent: 'filterBarPermisos',
            data: [
                {
                    opc: 'select',
                    id: 'permisos_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-2',
                    onchange: 'permisos.lsPermisos()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                },
                {
                    opc: 'select',
                    id: 'permisos_estatus',
                    lbl: 'Estatus:',
                    class: 'col-12 col-md-2',
                    onchange: 'permisos.lsPermisos()',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'pendiente', valor: 'Pendiente' },
                        { id: 'aprobado', valor: 'Aprobado' },
                        { id: 'rechazado', valor: 'Rechazado' }
                    ]
                },
                {
                    opc: 'select',
                    id: 'permisos_tipo',
                    lbl: 'Tipo:',
                    class: 'col-12 col-md-2',
                    onchange: 'permisos.lsPermisos()',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'incapacidad', valor: 'Incapacidad' },
                        { id: 'vacaciones', valor: 'Vacaciones' },
                        { id: 'permiso', valor: 'Permiso' }
                    ]
                },
                {
                    opc: 'button',
                    id: 'btnAddPermiso',
                    text: 'Solicitar Permiso',
                    icon: 'icon-plus',
                    class: 'col-12 col-md-2',
                    className: 'w-full',
                    color_btn: 'primary',
                    onClick: () => this.addPermiso()
                }
            ]
        });
    }

    lsPermisos() {
        this.createTable({
            parent: 'containerPermisos',
            idFilterBar: 'filterBarPermisos',
            data: {
                opc: 'lsPermisos',
                subsidiaries_id: $('#permisos_sub').val() || '0',
                estatus: $('#permisos_estatus').val() || '',
                tipo: $('#permisos_tipo').val() || ''
            },
            conf: {
                datatable: true,
                pag: 15
            },
            coffeesoft: true,
            attr: {
                id: 'tbPermisos',
                theme: 'corporativo',
                title: 'Permisos',
                subtitle: '',
                center: [4, 5, 6, 7, 8]
            }
        });
    }

    addPermiso() {
        this.createModalForm({
            id: 'formPermiso',
            bootbox: {
                title: 'Solicitar Permiso',
                closeButton: true
            },
            data: { opc: 'addPermiso' },
            autofill: false,
            json: this.jsonPermiso(),
            success: (response) => {
                if (response.status == 200) {
                    this.closedModal(response);
                    this.lsPermisos();
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

        this.loadEmpleadosSelect();
    }

    async loadEmpleadosSelect() {
        const empleados = await useFetch({
            url: this._link,
            data: {
                opc: 'init'
            }
        });

        if (empleados && empleados.status === 200) {
            const lsEmp = await useFetch({
                url: this._link,
                data: {
                    opc: 'getEmpleadosSelect',
                    subsidiaries_id: '0'
                }
            });

            if (lsEmp) {
                $('#empleado_id').option_select({
                    data: lsEmp,
                    placeholder: 'Seleccionar colaborador',
                    select2: true
                });
            }
        }
    }

    jsonPermiso() {
        return [
            {
                opc: 'select',
                lbl: 'Colaborador:',
                id: 'empleado_id',
                class: 'col-12 mb-3',
                data: []
            },
            {
                opc: 'select',
                lbl: 'Tipo:',
                id: 'tipo',
                class: 'col-12 col-md-6 mb-3',
                data: [
                    { id: 'incapacidad', valor: 'Incapacidad' },
                    { id: 'vacaciones', valor: 'Vacaciones' },
                    { id: 'permiso', valor: 'Permiso' }
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
            },
            {
                opc: 'textarea',
                lbl: 'Razon:',
                id: 'razon',
                class: 'col-12 mb-3',
                rows: 3,
                required: false
            }
        ];
    }

    aprobarPermiso(id) {
        app.modalAutorizacion('aprobar_permiso', 'rrhh_permisos', id, async () => {
            const req = await useFetch({
                url: this._link,
                data: {
                    opc: 'editPermiso',
                    id: id,
                    estatus: 'aprobado',
                    aprobado_por: this.usr,
                    aprobado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
            if (req.status === 200) {
                this.lsPermisos();
                alert({
                    icon: "success",
                    title: "Aprobado",
                    text: "Permiso aprobado correctamente",
                    btn1: true
                });
            }
        });
    }

    rechazarPermiso(id) {
        app.modalAutorizacion('rechazar_permiso', 'rrhh_permisos', id, async () => {
            const req = await useFetch({
                url: this._link,
                data: {
                    opc: 'editPermiso',
                    id: id,
                    estatus: 'rechazado',
                    rechazado_por: this.usr,
                    rechazado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
            if (req.status === 200) {
                this.lsPermisos();
                alert({
                    icon: "info",
                    title: "Rechazado",
                    text: "Permiso rechazado",
                    btn1: true
                });
            }
        });
    }
}

$(function () {
    permisos = new Permisos(api, 'root');
});
