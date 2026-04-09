let api = 'ctrl/ctrl-rrhh.php';
let app;

$(async () => {
    app = new App(api, 'root');
    await app.init();
    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "RRHH";
        this.subsidiaries = [];
        this.puestos = [];
        this.turnos = [];
        this.selectedSub = '0';
    }

    async init() {
        const req = await useFetch({ url: this.link, data: { opc: 'init' } });
        if (!req) return;
        this.subsidiaries = req.subsidiaries || [];
        this.puestos = req.puestos || [];
        this.turnos = req.turnos || [];
        this.rol = req.rol;
        this.usr = req.usr;
        this.sub = req.sub;
        if (this.sub) this.selectedSub = this.sub;
    }

    render() {
        this.layout();
    }

    layout() {
        this.tabLayout({
            parent: 'root',
            json: [
                {
                    id: 'resumen',
                    tab: 'Resumen',
                    icon: 'icon-chart-bar',
                    onClick: () => this.renderResumen()
                },
                {
                    id: 'personal',
                    tab: 'Personal',
                    icon: 'icon-users',
                    onClick: () => this.renderPersonal()
                },
                {
                    id: 'permisos',
                    tab: 'Permisos',
                    icon: 'icon-doc-text',
                    onClick: () => this.renderPermisos()
                },
                {
                    id: 'incidencias',
                    tab: 'Incidencias',
                    icon: 'icon-clock',
                    onClick: () => this.renderIncidencias()
                },
                {
                    id: 'nomina',
                    tab: 'Nomina',
                    icon: 'icon-money',
                    onClick: () => this.renderNomina()
                }
            ]
        });
    }

    // ===================== RESUMEN =====================

    async renderResumen() {
        $('#container-resumen').html(`
            <div id="filterBarResumen" class="mb-3"></div>
            <div id="resumenCards" class="mb-3"></div>
            <div id="resumenPermisos"></div>
        `);

        this.filterBarResumen();

        const req = await useFetch({
            url: this.link,
            data: { opc: 'showResumen', subsidiaries_id: this.selectedSub }
        });

        if (req && req.status === 200) {
            this.renderResumenCards(req.counts);
            this.renderResumenPermisos(req.permisos);
        }
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
                    onchange: 'app.onResumenSubChange()',
                    data: [{ id: '0', valor: 'Todas' }, ...this.subsidiaries]
                }
            ]
        });
    }

    onResumenSubChange() {
        this.selectedSub = $('#resumen_sub').val();
        this.renderResumen();
    }

    renderResumenCards(counts) {
        if (!counts) return;
        $('#resumenCards').html(`
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <p class="text-gray-400 text-sm">Empleados Activos</p>
                    <p class="text-2xl font-bold text-green-400">${counts.activos || 0}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <p class="text-gray-400 text-sm">Altas del Periodo</p>
                    <p class="text-2xl font-bold text-blue-400">${counts.altas_periodo || 0}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <p class="text-gray-400 text-sm">Bajas del Periodo</p>
                    <p class="text-2xl font-bold text-red-400">${counts.bajas_periodo || 0}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <p class="text-gray-400 text-sm">Total Registrados</p>
                    <p class="text-2xl font-bold text-purple-400">${counts.total || 0}</p>
                </div>
            </div>
        `);
    }

    renderResumenPermisos(permisos) {
        if (!permisos || !permisos.row) return;
        this.createTable({
            parent: 'resumenPermisos',
            attr: {
                id: 'tbResumenPermisos',
                theme: 'corporativo',
                title: 'Permisos Pendientes'
            },
            json: permisos.row
        });
    }

    // ===================== PERSONAL =====================

    renderPersonal() {
        $('#container-personal').html(`
            <div id="filterBarPersonal" class="mb-3"></div>
            <div id="personalStats" class="mb-3"></div>
            <div id="containerPersonalTable"></div>
        `);

        this.filterBarPersonal();
        this.lsPersonal();
        this.showPersonalStats();
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
                    onchange: 'app.lsPersonal()',
                    data: [{ id: '0', valor: 'Todas' }, ...this.subsidiaries]
                },
                {
                    opc: 'select',
                    id: 'personal_estado',
                    lbl: 'Estado:',
                    class: 'col-12 col-md-2',
                    onchange: 'app.lsPersonal()',
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
                    onchange: 'app.lsPersonal()',
                    data: [{ id: '0', valor: 'Todos' }, ...this.puestos]
                },
                {
                    opc: 'select',
                    id: 'personal_turno',
                    lbl: 'Turno:',
                    class: 'col-12 col-md-2',
                    onchange: 'app.lsPersonal()',
                    data: [{ id: '0', valor: 'Todos' }, ...this.turnos]
                },
                {
                    opc: 'button',
                    id: 'btnAddPersonal',
                    text: 'Nuevo Colaborador',
                    icon: 'icon-plus',
                    class: 'col-12 col-md-2',
                    className: 'btn-primary w-100',
                    onClick: () => this.addPersonal()
                }
            ]
        });
    }

    async lsPersonal() {
        const req = await useFetch({
            url: this.link,
            data: {
                opc: 'lsPersonal',
                subsidiaries_id: $('#personal_sub').val() || '0',
                estado: $('#personal_estado').val() || '',
                puesto_id: $('#personal_puesto').val() || '0',
                turno_id: $('#personal_turno').val() || '0'
            }
        });

        this.createTable({
            parent: 'containerPersonalTable',
            attr: {
                id: 'tbPersonal',
                theme: 'corporativo',
                title: 'Colaboradores'
            },
            json: (req && req.row) ? req.row : []
        });
    }

    async showPersonalStats() {
        const req = await useFetch({
            url: this.link,
            data: { opc: 'showPersonal', subsidiaries_id: $('#personal_sub').val() || '0' }
        });
        if (req && req.status === 200 && req.counts) {
            $('#personalStats').html(`
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                        <span class="text-green-400 text-xl font-bold">${req.counts.activos || 0}</span>
                        <p class="text-gray-400 text-xs">Activos</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                        <span class="text-red-400 text-xl font-bold">${req.counts.bajas || 0}</span>
                        <p class="text-gray-400 text-xs">Bajas</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                        <span class="text-yellow-400 text-xl font-bold">${req.counts.suspendidos || 0}</span>
                        <p class="text-gray-400 text-xs">Suspendidos</p>
                    </div>
                </div>
            `);
        }
    }

    addPersonal() {
        this.createModalForm({
            title: 'Nuevo Colaborador',
            size: 'lg',
            json: this.jsonPersonal(),
            onSubmit: async (formData) => {
                formData.opc = 'addPersonal';
                const req = await useFetch({ url: this.link, data: formData });
                if (req.status === 200) {
                    this.closedModal();
                    this.lsPersonal();
                    this.showPersonalStats();
                    Swal.fire('Registrado', req.message, 'success');
                } else {
                    Swal.fire('Error', req.message, 'error');
                }
            }
        });
    }

    async editPersonal(id) {
        const req = await useFetch({ url: this.link, data: { opc: 'getPersonal', id: id } });
        if (req.status !== 200) return Swal.fire('Error', 'No se encontro el registro', 'error');

        this.createModalForm({
            title: 'Editar Colaborador',
            size: 'lg',
            json: this.jsonPersonal(req.data),
            onSubmit: async (formData) => {
                formData.opc = 'editPersonal';
                formData.id = id;
                const res = await useFetch({ url: this.link, data: formData });
                if (res.status === 200) {
                    this.closedModal();
                    this.lsPersonal();
                    Swal.fire('Actualizado', res.message, 'success');
                } else {
                    Swal.fire('Error', res.message, 'error');
                }
            }
        });
    }

    jsonPersonal(data = {}) {
        return [
            {
                opc: 'input',
                type: 'texto',
                id: 'nombre',
                lbl: 'Nombre:',
                class: 'col-12 col-md-4',
                required: true,
                value: data.nombre || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'apellido_paterno',
                lbl: 'Apellido Paterno:',
                class: 'col-12 col-md-4',
                required: true,
                value: data.apellido_paterno || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'apellido_materno',
                lbl: 'Apellido Materno:',
                class: 'col-12 col-md-4',
                value: data.apellido_materno || ''
            },
            {
                opc: 'input',
                type: 'email',
                id: 'email',
                lbl: 'Email:',
                class: 'col-12 col-md-4',
                value: data.email || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'telefono',
                lbl: 'Telefono:',
                class: 'col-12 col-md-4',
                value: data.telefono || ''
            },
            {
                opc: 'input',
                type: 'date',
                id: 'fecha_nacimiento',
                lbl: 'Fecha Nacimiento:',
                class: 'col-12 col-md-4',
                value: data.fecha_nacimiento || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'curp',
                lbl: 'CURP:',
                class: 'col-12 col-md-4',
                value: data.curp || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'rfc',
                lbl: 'RFC:',
                class: 'col-12 col-md-4',
                value: data.rfc || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'nss',
                lbl: 'NSS:',
                class: 'col-12 col-md-4',
                value: data.nss || ''
            },
            {
                opc: 'select',
                id: 'puesto_id',
                lbl: 'Puesto:',
                class: 'col-12 col-md-4',
                required: true,
                data: this.puestos,
                value: data.puesto_id || ''
            },
            {
                opc: 'select',
                id: 'turno_id',
                lbl: 'Turno:',
                class: 'col-12 col-md-4',
                required: true,
                data: this.turnos,
                value: data.turno_id || ''
            },
            {
                opc: 'select',
                id: 'subsidiaries_id',
                lbl: 'Sucursal:',
                class: 'col-12 col-md-4',
                required: true,
                data: this.subsidiaries,
                value: data.subsidiaries_id || ''
            },
            {
                opc: 'select',
                id: 'tipo_contrato',
                lbl: 'Tipo Contrato:',
                class: 'col-12 col-md-4',
                data: [
                    { id: 'indefinido', valor: 'Indefinido' },
                    { id: 'temporal', valor: 'Temporal' },
                    { id: 'honorarios', valor: 'Honorarios' },
                    { id: 'eventual', valor: 'Eventual' }
                ],
                value: data.tipo_contrato || 'indefinido'
            },
            {
                opc: 'input',
                type: 'date',
                id: 'fecha_ingreso',
                lbl: 'Fecha Ingreso:',
                class: 'col-12 col-md-4',
                required: true,
                value: data.fecha_ingreso || ''
            },
            {
                opc: 'input',
                type: 'numero',
                id: 'salario_diario',
                lbl: 'Salario Diario:',
                class: 'col-12 col-md-4',
                required: true,
                value: data.salario_diario || ''
            },
            {
                opc: 'select',
                id: 'frecuencia_pago',
                lbl: 'Frecuencia Pago:',
                class: 'col-12 col-md-4',
                data: [
                    { id: 'semanal', valor: 'Semanal' },
                    { id: 'catorcenal', valor: 'Catorcenal' },
                    { id: 'quincenal', valor: 'Quincenal' },
                    { id: 'mensual', valor: 'Mensual' }
                ],
                value: data.frecuencia_pago || 'quincenal'
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'cuenta_bancaria',
                lbl: 'Cuenta Bancaria:',
                class: 'col-12 col-md-4',
                value: data.cuenta_bancaria || ''
            },
            {
                opc: 'input',
                type: 'texto',
                id: 'banco',
                lbl: 'Banco:',
                class: 'col-12 col-md-4',
                value: data.banco || ''
            },
            {
                opc: 'textarea',
                id: 'notas',
                lbl: 'Notas:',
                class: 'col-12',
                value: data.notas || ''
            }
        ];
    }

    deletePersonal(id) {
        this.swalQuestion({
            title: 'Dar de baja',
            text: 'Se cambiara el estado del colaborador a Baja',
            onConfirm: async () => {
                const req = await useFetch({
                    url: this.link,
                    data: { opc: 'statusPersonal', id: id, estado: 'baja' }
                });
                if (req.status === 200) {
                    this.lsPersonal();
                    this.showPersonalStats();
                }
            }
        });
    }

    // ===================== PERMISOS =====================

    renderPermisos() {
        $('#container-permisos').html(`
            <div id="filterBarPermisos" class="mb-3"></div>
            <div id="containerPermisosTable"></div>
        `);

        this.filterBarPermisos();
        this.lsPermisos();
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
                    onchange: 'app.lsPermisos()',
                    data: [{ id: '0', valor: 'Todas' }, ...this.subsidiaries]
                },
                {
                    opc: 'select',
                    id: 'permisos_estatus',
                    lbl: 'Estatus:',
                    class: 'col-12 col-md-2',
                    onchange: 'app.lsPermisos()',
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
                    onchange: 'app.lsPermisos()',
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
                    className: 'btn-primary w-100',
                    onClick: () => this.addPermiso()
                }
            ]
        });
    }

    async lsPermisos() {
        const req = await useFetch({
            url: this.link,
            data: {
                opc: 'lsPermisos',
                subsidiaries_id: $('#permisos_sub').val() || '0',
                estatus: $('#permisos_estatus').val() || '',
                tipo: $('#permisos_tipo').val() || ''
            }
        });

        this.createTable({
            parent: 'containerPermisosTable',
            attr: {
                id: 'tbPermisos',
                theme: 'corporativo',
                title: 'Permisos'
            },
            json: (req && req.row) ? req.row : []
        });
    }

    addPermiso() {
        this.createModalForm({
            title: 'Solicitar Permiso',
            size: 'md',
            json: this.jsonPermiso(),
            onSubmit: async (formData) => {
                formData.opc = 'addPermiso';
                const req = await useFetch({ url: this.link, data: formData });
                if (req.status === 200) {
                    this.closedModal();
                    this.lsPermisos();
                    Swal.fire('Registrado', req.message, 'success');
                } else {
                    Swal.fire('Error', req.message, 'error');
                }
            }
        });
    }

    jsonPermiso() {
        return [
            {
                opc: 'select',
                id: 'empleado_id',
                lbl: 'Colaborador:',
                class: 'col-12',
                required: true,
                data: []
            },
            {
                opc: 'select',
                id: 'tipo',
                lbl: 'Tipo:',
                class: 'col-12 col-md-6',
                required: true,
                data: [
                    { id: 'incapacidad', valor: 'Incapacidad' },
                    { id: 'vacaciones', valor: 'Vacaciones' },
                    { id: 'permiso', valor: 'Permiso' }
                ]
            },
            {
                opc: 'input',
                type: 'date',
                id: 'fecha_inicio',
                lbl: 'Fecha Inicio:',
                class: 'col-12 col-md-6',
                required: true
            },
            {
                opc: 'input',
                type: 'date',
                id: 'fecha_fin',
                lbl: 'Fecha Fin:',
                class: 'col-12 col-md-6',
                required: true
            },
            {
                opc: 'textarea',
                id: 'razon',
                lbl: 'Razon:',
                class: 'col-12'
            }
        ];
    }

    async aprobarPermiso(id) {
        this.modalAutorizacion('aprobar_permiso', 'rrhh_permisos', id, async () => {
            const req = await useFetch({
                url: this.link,
                data: {
                    opc: 'editPermiso',
                    id: id,
                    estatus: 'aprobado',
                    aprobado_por: this.usr,
                    aprobado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
            if (req.status === 200) {
                this.closedModal();
                this.lsPermisos();
                Swal.fire('Aprobado', 'Permiso aprobado correctamente', 'success');
            }
        });
    }

    async rechazarPermiso(id) {
        this.modalAutorizacion('rechazar_permiso', 'rrhh_permisos', id, async () => {
            const req = await useFetch({
                url: this.link,
                data: {
                    opc: 'editPermiso',
                    id: id,
                    estatus: 'rechazado',
                    rechazado_por: this.usr,
                    rechazado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
            if (req.status === 200) {
                this.closedModal();
                this.lsPermisos();
                Swal.fire('Rechazado', 'Permiso rechazado', 'info');
            }
        });
    }

    // ===================== INCIDENCIAS =====================

    renderIncidencias() {
        $('#container-incidencias').html(`
            <div id="filterBarIncidencias" class="mb-3"></div>
            <div id="containerIncidenciasTable"></div>
        `);

        this.filterBarIncidencias();
        this.lsIncidenciaDiario();
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
                    onchange: 'app.lsIncidenciaDiario()',
                    data: [{ id: '0', valor: 'Todas' }, ...this.subsidiaries]
                },
                {
                    opc: 'input-calendar',
                    id: 'incidencias_fecha',
                    lbl: 'Fecha:',
                    class: 'col-12 col-md-2'
                },
                {
                    opc: 'select',
                    id: 'incidencias_turno',
                    lbl: 'Turno:',
                    class: 'col-12 col-md-2',
                    onchange: 'app.lsIncidenciaDiario()',
                    data: [{ id: '0', valor: 'Todos' }, ...this.turnos]
                },
                {
                    opc: 'select',
                    id: 'incidencias_estatus',
                    lbl: 'Estatus:',
                    class: 'col-12 col-md-2',
                    onchange: 'app.lsIncidenciaDiario()',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'atiempo', valor: 'A Tiempo' },
                        { id: 'retardo', valor: 'Retardo' },
                        { id: 'falta', valor: 'Falta' },
                        { id: 'sin_estatus', valor: 'Sin Estatus' }
                    ]
                },
                {
                    opc: 'button',
                    id: 'btnBuscarInc',
                    text: 'Buscar',
                    icon: 'icon-search',
                    class: 'col-12 col-md-2',
                    className: 'btn-primary w-100',
                    onClick: () => this.lsIncidenciaDiario()
                }
            ]
        });
    }

    async lsIncidenciaDiario() {
        const fecha = $('#incidencias_fecha').val() || moment().format('YYYY-MM-DD');

        const req = await useFetch({
            url: this.link,
            data: {
                opc: 'lsIncidenciaDiario',
                fecha: fecha,
                subsidiaries_id: $('#incidencias_sub').val() || '0',
                turno_id: $('#incidencias_turno').val() || '0',
                estatus: $('#incidencias_estatus').val() || ''
            }
        });

        this.createTable({
            parent: 'containerIncidenciasTable',
            attr: {
                id: 'tbIncidencias',
                theme: 'corporativo',
                title: 'Incidencias - ' + fecha
            },
            json: (req && req.row) ? req.row : []
        });
    }

    async editIncidencia(id) {
        this.modalAutorizacion('cambiar_incidencia', 'rrhh_incidencias', id, async () => {
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
                confirmButtonText: 'Cambiar'
            });

            if (estatus) {
                const req = await useFetch({
                    url: this.link,
                    data: { opc: 'editIncidencia', id: id, estatus: estatus }
                });
                if (req.status === 200) {
                    this.lsIncidenciaDiario();
                    Swal.fire('Actualizado', req.message, 'success');
                }
            }
        });
    }

    // ===================== NOMINA =====================

    renderNomina() {
        $('#container-nomina').html(`
            <div id="filterBarNomina" class="mb-3"></div>
            <div id="containerNominaTable"></div>
        `);

        this.filterBarNomina();
        this.lsNomina();
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
                    onchange: 'app.lsNomina()',
                    data: [{ id: '0', valor: 'Todas' }, ...this.subsidiaries]
                },
                {
                    opc: 'button',
                    id: 'btnAddNomina',
                    text: 'Nuevo Periodo',
                    icon: 'icon-plus',
                    class: 'col-12 col-md-2',
                    className: 'btn-primary w-100',
                    onClick: () => this.addNominaPeriodo()
                }
            ]
        });
    }

    async lsNomina() {
        const req = await useFetch({
            url: this.link,
            data: {
                opc: 'lsNomina',
                subsidiaries_id: $('#nomina_sub').val() || '0'
            }
        });

        this.createTable({
            parent: 'containerNominaTable',
            attr: {
                id: 'tbNomina',
                theme: 'corporativo',
                title: 'Periodos de Nomina'
            },
            json: (req && req.row) ? req.row : []
        });
    }

    addNominaPeriodo() {
        this.createModalForm({
            title: 'Nuevo Periodo de Nomina',
            size: 'md',
            json: [
                {
                    opc: 'select',
                    id: 'subsidiaries_id',
                    lbl: 'Sucursal:',
                    class: 'col-12',
                    required: true,
                    data: this.subsidiaries
                },
                {
                    opc: 'select',
                    id: 'frecuencia',
                    lbl: 'Frecuencia:',
                    class: 'col-12 col-md-6',
                    required: true,
                    data: [
                        { id: 'semanal', valor: 'Semanal' },
                        { id: 'catorcenal', valor: 'Catorcenal' },
                        { id: 'quincenal', valor: 'Quincenal' },
                        { id: 'mensual', valor: 'Mensual' }
                    ]
                },
                {
                    opc: 'input',
                    type: 'date',
                    id: 'fecha_inicio',
                    lbl: 'Fecha Inicio:',
                    class: 'col-12 col-md-6',
                    required: true
                },
                {
                    opc: 'input',
                    type: 'date',
                    id: 'fecha_fin',
                    lbl: 'Fecha Fin:',
                    class: 'col-12 col-md-6',
                    required: true
                }
            ],
            onSubmit: async (formData) => {
                formData.opc = 'addNomina';
                formData.companies_id = 1;
                const req = await useFetch({ url: this.link, data: formData });
                if (req.status === 200) {
                    this.closedModal();
                    this.lsNomina();
                    Swal.fire('Calculada', req.message, 'success');
                } else {
                    Swal.fire('Error', req.message, 'error');
                }
            }
        });
    }

    async verNominaDetalle(periodoId) {
        const req = await useFetch({
            url: this.link,
            data: { opc: 'showNomina', periodo_id: periodoId }
        });

        if (req && req.status === 200) {
            $('#containerNominaTable').html('');
            $('#containerNominaTable').append(`
                <div class="mb-3">
                    <button class="btn btn-sm btn-secondary" onclick="app.lsNomina()">
                        <i class="icon-left-open"></i> Volver
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                        <span class="text-green-400 text-xl font-bold">$${parseFloat(req.totals.total_efectivo || 0).toFixed(2)}</span>
                        <p class="text-gray-400 text-xs">Total Efectivo</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                        <span class="text-blue-400 text-xl font-bold">$${parseFloat(req.totals.total_bancos || 0).toFixed(2)}</span>
                        <p class="text-gray-400 text-xs">Total Bancos</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                        <span class="text-purple-400 text-xl font-bold">$${parseFloat(req.totals.total_general || 0).toFixed(2)}</span>
                        <p class="text-gray-400 text-xs">Total General</p>
                    </div>
                </div>
                <div id="tbNominaDetalle"></div>
            `);

            this.createTable({
                parent: 'tbNominaDetalle',
                attr: {
                    id: 'tbNominaDetalleTable',
                    theme: 'corporativo',
                    title: 'Detalle de Nomina'
                },
                json: req.row || []
            });
        }
    }

    async aprobarNomina(periodoId) {
        this.modalAutorizacion('aprobar_nomina', 'rrhh_nomina_periodos', periodoId, async () => {
            const req = await useFetch({
                url: this.link,
                data: {
                    opc: 'editNomina',
                    id: periodoId,
                    estatus: 'aprobada',
                    aprobado_por: this.usr,
                    aprobado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
            if (req.status === 200) {
                this.closedModal();
                this.lsNomina();
                Swal.fire('Aprobada', 'Nomina aprobada correctamente', 'success');
            }
        });
    }

    // ===================== AUTORIZACION (RF-06) =====================

    modalAutorizacion(accion, tabla, registroId, onSuccess) {
        Swal.fire({
            title: 'Autorizacion Requerida',
            text: 'Este cambio requiere autorizacion. Ingresa tu contraseña.',
            input: 'password',
            inputPlaceholder: 'Contraseña',
            showCancelButton: true,
            confirmButtonText: 'Autorizar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#8b5cf6',
            preConfirm: async (password) => {
                if (!password) {
                    Swal.showValidationMessage('Ingresa tu contraseña');
                    return false;
                }
                const req = await useFetch({
                    url: this.link,
                    data: {
                        opc: 'addAutorizacion',
                        password: password,
                        accion: accion,
                        tabla_afectada: tabla,
                        registro_id: registroId,
                        valor_anterior: '',
                        valor_nuevo: ''
                    }
                });
                if (req.status !== 200) {
                    Swal.showValidationMessage(req.message || 'Contraseña incorrecta');
                    return false;
                }
                return true;
            }
        }).then((result) => {
            if (result.isConfirmed && onSuccess) {
                onSuccess();
            }
        });
    }
}
