let api = 'ctrl/ctrl-rrhh.php';
let app;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });
    window._rrhhData = {
        subsidiaries: data.subsidiaries || [],
        puestos: data.puestos || [],
        turnos: data.turnos || [],
        usr: data.usr,
        sub: data.sub,
        rol: data.rol
    };
    app = new App(api, 'root');
    app.init();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "RRHH";
        this.subsidiaries = window._rrhhData.subsidiaries;
        this.puestos = window._rrhhData.puestos;
        this.turnos = window._rrhhData.turnos;
        this.usr = window._rrhhData.usr;
        this.sub = window._rrhhData.sub;
        this.rol = window._rrhhData.rol;
        this.selectedSub = this.sub || '0';
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        // this.renderTabs();
        // this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'w-full min-h-screen p-2',
                container: [
                    {
                        type: 'div',
                        id: `container${this.PROJECT_NAME}`,
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    renderTabs() {
        const activeModule = localStorage.getItem('rrhh_module') || 'resumen';

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            showBorder: false,
            json: [
                {
                    id: "resumen",
                    tab: "Resumen",
                    lucideIcon: "layout-dashboard",
                    iconColor: "text-purple-400",
                    active: activeModule === 'resumen',
                    onClick: () => {
                        localStorage.setItem('rrhh_module', 'resumen');
                        this.renderActiveTab('resumen');
                    }
                },
                {
                    id: "personal",
                    tab: "Personal",
                    lucideIcon: "users",
                    iconColor: "text-blue-400",
                    active: activeModule === 'personal',
                    onClick: () => {
                        localStorage.setItem('rrhh_module', 'personal');
                        this.renderActiveTab('personal');
                    }
                },
                {
                    id: "permisos",
                    tab: "Permisos",
                    lucideIcon: "file-text",
                    iconColor: "text-orange-400",
                    active: activeModule === 'permisos',
                    onClick: () => {
                        localStorage.setItem('rrhh_module', 'permisos');
                        this.renderActiveTab('permisos');
                    }
                },
                {
                    id: "incidencias",
                    tab: "Incidencias",
                    lucideIcon: "clock",
                    iconColor: "text-green-400",
                    active: activeModule === 'incidencias',
                    onClick: () => {
                        localStorage.setItem('rrhh_module', 'incidencias');
                        this.renderActiveTab('incidencias');
                    }
                },
                {
                    id: "nomina",
                    tab: "Nomina",
                    lucideIcon: "wallet",
                    iconColor: "text-yellow-400",
                    active: activeModule === 'nomina',
                    onClick: () => {
                        localStorage.setItem('rrhh_module', 'nomina');
                        this.renderActiveTab('nomina');
                    }
                }
            ]
        });
    }

    renderActiveTab(module) {
        const activeModule = module || localStorage.getItem('rrhh_module') || 'resumen';

        const tabActions = {
            'resumen':     () => resumen.render(),
            'personal':    () => personal.render(),
            'permisos':    () => permisos.render(),
            'incidencias': () => incidencias.render(),
            'nomina':      () => nomina.render()
        };

        if (tabActions[activeModule]) {
            tabActions[activeModule]();
        }
    }

    modalAutorizacion(accion, tabla, registroId, onSuccess) {
        Swal.fire({
            title: 'Autorizacion Requerida',
            text: 'Ingresa tu contraseña para autorizar.',
            input: 'password',
            inputPlaceholder: 'Contraseña',
            showCancelButton: true,
            confirmButtonText: 'Autorizar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#7c3aed',
            preConfirm: async (password) => {
                if (!password) {
                    Swal.showValidationMessage('Ingresa tu contraseña');
                    return false;
                }
                const req = await useFetch({
                    url: this._link,
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
