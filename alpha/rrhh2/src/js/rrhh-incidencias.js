let incidencias;

class Incidencias extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Incidencias";
        this.viewMode = 'diario';
    }

    render() {
        this.layoutIncidencias();
        this.filterBarIncidencias();
        this.lsIncidenciaDiario();
    }

    layoutIncidencias() {
        $('#container-incidencias').html('<div id="filterBarIncidencias" class="mb-3"></div><div id="containerIncidencias"></div>');
    }

    filterBarIncidencias() {
        this.createfilterBar({
            parent: 'filterBarIncidencias',
            data: [
                {
                    opc: 'select',
                    id: 'incidencias_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-2',
                    onchange: 'incidencias.refreshView()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                },
                {
                    opc: 'select',
                    id: 'incidencias_turno',
                    lbl: 'Turno:',
                    class: 'col-12 col-md-2',
                    onchange: 'incidencias.refreshView()',
                    data: [
                        { id: '0', valor: 'Todos' },
                        ...this.turnos
                    ]
                },
                {
                    opc: 'select',
                    id: 'incidencias_estatus',
                    lbl: 'Estatus:',
                    class: 'col-12 col-md-2',
                    onchange: 'incidencias.refreshView()',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'atiempo', valor: 'A Tiempo' },
                        { id: 'retardo', valor: 'Retardo' },
                        { id: 'falta', valor: 'Falta' },
                        { id: 'sin_estatus', valor: 'Sin Estatus' }
                    ]
                },
                {
                    opc: 'select',
                    id: 'incidencias_vista',
                    lbl: 'Vista:',
                    class: 'col-12 col-md-2',
                    onchange: 'incidencias.switchView()',
                    data: [
                        { id: 'diario', valor: 'Diario' },
                        { id: 'semanal', valor: 'Semanal' }
                    ]
                },
                {
                    opc: 'input-calendar',
                    id: 'calendarIncidencias',
                    lbl: 'Fecha:',
                    class: 'col-12 col-md-2'
                },
                {
                    opc: 'btn',
                    id: 'btnBuscarInc',
                    text: 'Buscar',
                    class: 'col-12 col-md-1',
                    color_btn: 'primary',
                    fn: 'incidencias.refreshView()'
                }
            ]
        });

        dataPicker({
            parent: 'calendarIncidencias',
            type: 'simple',
            rangeDefault: {
                startDate: moment(),
                singleDatePicker: true,
                showDropdowns: true,
                autoApply: true,
                locale: { format: "DD-MM-YYYY" }
            },
            onSelect: () => this.refreshView()
        });
    }

    switchView() {
        this.viewMode = $('#incidencias_vista').val();
        this.refreshView();
    }

    refreshView() {
        if (this.viewMode === 'semanal') {
            this.lsIncidenciaSemanal();
        } else {
            this.lsIncidenciaDiario();
        }
    }

    lsIncidenciaDiario() {
        const rangePicker = getDataRangePicker('calendarIncidencias');
        const fecha = rangePicker.fi || moment().format('YYYY-MM-DD');

        this.createTable({
            parent: 'containerIncidencias',
            idFilterBar: 'filterBarIncidencias',
            data: {
                opc: 'lsIncidenciaDiario',
                fecha: fecha,
                subsidiaries_id: $('#incidencias_sub').val() || '0',
                turno_id: $('#incidencias_turno').val() || '0',
                estatus: $('#incidencias_estatus').val() || ''
            },
            conf: {
                datatable: true,
                pag: 15
            },
            coffeesoft: true,
            attr: {
                id: 'tbIncidencias',
                theme: 'dark',
                title: 'Incidencias - ' + fecha,
                subtitle: '',
                center: [3, 4, 5, 6]
            }
        });
    }

    async lsIncidenciaSemanal() {
        const rangePicker = getDataRangePicker('calendarIncidencias');
        const baseDate = moment(rangePicker.fi || moment().format('YYYY-MM-DD'));
        const startOfWeek = baseDate.clone().startOf('isoWeek');
        const endOfWeek = startOfWeek.clone().add(6, 'days');

        const dates = [];
        for (let d = startOfWeek.clone(); d.isSameOrBefore(endOfWeek); d.add(1, 'days')) {
            dates.push(d.format('YYYY-MM-DD'));
        }

        const req = await useFetch({
            url: this._link,
            data: {
                opc: 'lsIncidenciaPersonalizado',
                fecha_inicio: dates[0],
                fecha_fin: dates[dates.length - 1],
                subsidiaries_id: $('#incidencias_sub').val() || '0'
            }
        });

        if (req && req.status === 200) {
            this.incidenciaGrid({
                parent: 'containerIncidencias',
                id: 'gridIncidencias',
                title: 'Incidencias - Semana del ' + dates[0] + ' al ' + dates[dates.length - 1],
                json: req.data || [],
                dates: dates,
                onStatusChange: (data) => this.onGridStatusChange(data)
            });
        }
    }

    async onGridStatusChange(data) {
        if (data.incidencia_id) {
            const req = await useFetch({
                url: this._link,
                data: {
                    opc: 'editIncidencia',
                    id: data.incidencia_id,
                    estatus: data.estatus
                }
            });

            if (req && req.status === 200) {
                alert({
                    icon: "success",
                    text: "Incidencia actualizada",
                    btn1: true
                });
            }
        }
    }

    editIncidencia(id) {
        app.modalAutorizacion('cambiar_incidencia', 'rrhh_incidencias', id, async () => {
            const { value: estatus } = await Swal.fire({
                title: 'Cambiar estatus',
                input: 'select',
                inputOptions: {
                    atiempo: 'A Tiempo',
                    retardo: 'Retardo',
                    falta: 'Falta',
                    vacaciones: 'Vacaciones',
                    incapacidad: 'Incapacidad',
                    reconocimiento: 'Reconocimiento',
                    sin_estatus: 'Sin Estatus'
                },
                showCancelButton: true,
                confirmButtonText: 'Cambiar',
                confirmButtonColor: '#7c3aed'
            });

            if (estatus) {
                const req = await useFetch({
                    url: this._link,
                    data: {
                        opc: 'editIncidencia',
                        id: id,
                        estatus: estatus
                    }
                });
                if (req.status === 200) {
                    this.refreshView();
                    alert({
                        icon: "success",
                        text: req.message,
                        btn1: true
                    });
                }
            }
        });
    }
}

