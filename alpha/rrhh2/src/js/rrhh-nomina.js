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
                theme: 'dark',
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

    _avatarColors() {
        return [
            'from-purple-500 to-pink-500',
            'from-green-500 to-teal-500',
            'from-blue-500 to-purple-500',
            'from-orange-500 to-red-500',
            'from-pink-500 to-purple-500',
            'from-teal-500 to-blue-500',
            'from-yellow-500 to-orange-500',
            'from-red-500 to-pink-500',
            'from-indigo-500 to-purple-500',
            'from-green-500 to-blue-500'
        ];
    }

    _initials(name) {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
    }

    async verNominaDetalle(periodoId) {
        const req = await useFetch({
            url: this._link,
            data: { opc: 'showNomina', periodo_id: periodoId }
        });

        if (req && req.status === 200) {
            $('#containerNomina').html('<div id="nominaBack" class="mb-3"></div><div id="tbNominaDetalle"></div>');
            $('#nominaBack').html('<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors" onclick="nomina.lsNomina()"><i class="icon-left-open"></i> Volver</button>');

            const avatarColors = this._avatarColors();

            this.coffeeStyledTable({
                parent: 'tbNominaDetalle',
                id: 'tbNominaDetalleTable',
                theme: 'dark',
                title: 'Detalle de Nomina',
                subtitle: `Periodo #${periodoId}`,
                statusIcon: 'pending',
                minWidth: '1100px',
                summary: [
                    { label: 'Total Efectivo', value: formatPrice(req.totals.total_efectivo || 0), color: 'text-green-400' },
                    { label: 'Total Bancos', value: formatPrice(req.totals.total_bancos || 0), color: 'text-blue-400' },
                    { label: 'Total General', value: formatPrice(req.totals.total_general || 0), color: 'text-purple-400' },
                    { label: 'Colaboradores', value: req.totals.total_colaboradores || 0 }
                ],
                thead: [
                    { key: 'nombre',         label: 'Colaborador',      align: 'left' },
                    { key: 'puesto',         label: 'Puesto',           align: 'left' },
                    { key: 'dias_laborados', label: 'Dias<br>Laborados', align: 'right' },
                    { key: 'dias_faltas',    label: 'Faltas',           align: 'right' },
                    { key: 'sueldo_diario',  label: 'Sueldo<br>Diario', align: 'right' },
                    { key: 'bonos',          label: 'Bonos',            align: 'right' },
                    { key: 'descuentos',     label: 'Descuentos',       align: 'right' },
                    { key: 'total_nomina',   label: 'Total<br>Nomina',  align: 'right', width: '120px' }
                ],
                rows: req.row || [],
                cellRenderer: (key, val, row) => {
                    if (key === 'nombre') {
                        const idx = (row.id || 0) % avatarColors.length;
                        const initials = this._initials(val);
                        return `<div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[idx]} flex items-center justify-center text-[10px] font-bold text-white">${initials}</div>
                            <div><p class="text-xs font-medium text-white">${val}</p><p class="text-[10px] text-gray-500">${row.codigo || ''}</p></div>
                        </div>`;
                    }
                    if (key === 'puesto') {
                        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/15 text-purple-400 border-purple-500/30">${val}</span>`;
                    }
                    if (key === 'bonos') {
                        const n = parseFloat(val) || 0;
                        return n > 0
                            ? `<span class="text-green-400">${formatPrice(n)}</span>`
                            : `<span class="text-gray-500">—</span>`;
                    }
                    if (key === 'descuentos') {
                        const n = parseFloat(val) || 0;
                        return n > 0
                            ? `<span class="text-red-400">-${formatPrice(n)}</span>`
                            : `<span class="text-gray-500">—</span>`;
                    }
                    if (key === 'total_nomina') {
                        return `<span class="text-sm font-bold text-white">${formatPrice(parseFloat(val) || 0)}</span>`;
                    }
                    if (key === 'sueldo_diario') {
                        return formatPrice(parseFloat(val) || 0);
                    }
                    return null;
                },
                actions: [
                    { text: 'Descargar XLS', color: 'primary', icon: '<i class="icon-download mr-1"></i>' },
                    { text: 'Aprobar', color: 'success', onClick: `nomina.aprobarNomina(${periodoId})` },
                    { text: 'Rechazar', color: 'danger' }
                ]
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

