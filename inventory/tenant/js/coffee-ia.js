let apiCoffeeIA = 'ctrl/ctrl-coffee-ia.php';
let coffeeIA, assistants, assistantCompanies;
let dataCoffeeIA = {};

// -- CoffeeIAGroup --

// Modelos, esfuerzo y prompt de cada asistente, y a qué empresas les llega.
// Lo que se deja vacío sigue al .env y al archivo de prompt del módulo.
class CoffeeIAGroup extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'CoffeeIA';
    }

    async render() {
        if ($(`#tabs${this.PROJECT_NAME}`).length) return;

        dataCoffeeIA = await useFetch({ url: this._link, data: { opc: 'init' } }) || {};
        this.renderTabs();
        this.renderActiveTab();
    }

    renderTabs() {
        this.tabLayout({
            parent: 'container-grp-coffeeia',
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            type: 'button',
            json: [
                {
                    id: 'ia-asistentes',
                    tab: 'Asistentes',
                    lucideIcon: 'bot',
                    active: true,
                    onClick: () => assistants.render()
                },
                {
                    id: 'ia-empresas',
                    tab: 'Empresas',
                    lucideIcon: 'building',
                    onClick: () => assistantCompanies.render()
                }
            ]
        });
    }

    renderActiveTab() {
        assistants.render();
    }
}

// -- Assistants --

class Assistants extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Assistants';
    }

    render() {
        if ($(`#filterBar${this.PROJECT_NAME}`).length) return;

        this.layout();
        this.filterBar();
        this.keyNotice();
        this.lsAssistants();
    }

    layout() {
        $('#container-ia-asistentes').html(`<div id="filterBar${this.PROJECT_NAME}" class="mb-2"></div><div id="container${this.PROJECT_NAME}"></div>`);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: dataCoffeeIA.statusFilter || [],
                    onchange: 'assistants.lsAssistants()'
                }
            ]
        });
    }

    // Sin llave nada de esto corre: se avisa arriba de la tabla en vez de esperar
    // a que alguien pregunte en el almacén y le salga el 503.
    keyNotice() {
        if (!dataCoffeeIA.defaults || dataCoffeeIA.defaults.key) return;

        $(`#filterBar${this.PROJECT_NAME}`).after(
            $('<div>', { class: 'mb-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-center gap-2' }).append(
                $('<i>', { 'data-lucide': 'triangle-alert', class: 'w-4 h-4 shrink-0' }),
                $('<span>', { text: 'Falta la llave de Ollama (OLLAMA_API_KEY en coffee/app/credentials/.env). Los asistentes no responderán hasta configurarla.' })
            )
        );
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    lsAssistants() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsAssistants' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [5, 6, 7, 8],
                right: []
            }
        });
    }

    async editAssistant(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getAssistant', id: id } });

        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el asistente', btn1: true });
            return;
        }

        const data = request.data;

        this.createModalForm({
            id: 'formAssistantEdit',
            data: { opc: 'editAssistant', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Modelos · <span class="text-blue-600 font-bold">${esc(data.name)}</span>` },
            autofill: data,
            json: this.jsonAssistant(),
            success: (r) => afterSave(r, () => this.lsAssistants())
        });
    }

    // El prompt abre con lo que hoy le llega al modelo: el suyo si ya tiene uno,
    // o el del archivo si todavía no. Guardarlo lo vuelve "Personalizado".
    async editPrompt(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getPrompt', id: id } });

        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el prompt', btn1: true });
            return;
        }

        const data = request.data;

        this.createModalForm({
            id: 'formAssistantPrompt',
            data: { opc: 'editPrompt', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Prompt · <span class="text-blue-600 font-bold">${esc(data.name)}</span>`, size: 'xl' },
            json: this.jsonPrompt(data),
            success: (r) => afterSave(r, () => this.lsAssistants())
        });
    }

    resetPrompt(id) {
        this.swalQuestion({
            opts: {
                title: '¿Volver al archivo?',
                text: 'Se borra el prompt personalizado y el asistente vuelve a leer su archivo .md. No se puede deshacer.',
                icon: 'warning'
            },
            data: { opc: 'resetPrompt', id: id },
            methods: { send: (r) => afterSave(r, () => this.lsAssistants()) }
        });
    }

    statusAssistant(id, active) {
        this.swalQuestion({
            opts: {
                title: active == 1 ? '¿Encender asistente?' : '¿Apagar asistente?',
                text: active == 1
                    ? 'Vuelve a responder en las empresas que lo tienen encendido.'
                    : 'Deja de responder en todas las empresas, aunque la tengan encendida.',
                icon: 'warning'
            },
            data: { opc: 'statusAssistant', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsAssistants()) }
        });
    }

    jsonAssistant() {
        const d = dataCoffeeIA.defaults || {};

        return [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'code',
                lbl: 'Código',
                disabled: true,
                required: false,
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'textarea',
                id: 'description',
                lbl: 'Descripción',
                rows: 2,
                required: false,
                class: 'col-12 mb-3'
            },
            {
                opc: 'input',
                id: 'text_model',
                lbl: 'Modelo de texto',
                placeholder: `Por defecto: ${d.text_model || '-'}`,
                required: false,
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'vision_model',
                lbl: 'Modelo de visión (fotos)',
                placeholder: `Por defecto: ${d.vision_model || '-'}`,
                required: false,
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'think',
                lbl: 'Esfuerzo de razonamiento',
                data: dataCoffeeIA.thinks || [],
                required: false,
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'div',
                class: 'col-12 mb-1',
                text: 'Vacío = lo del .env. Si cambias el modelo de texto, deja el esfuerzo en Automático salvo que sepas que el modelo admite ese nivel: uno que no admite responde con error.',
                css: { fontSize: '12px', color: '#6B7280' }
            }
        ];
    }

    jsonPrompt(data) {
        const sources = {
            custom: 'Personalizado: este texto manda sobre el archivo.',
            file:   `Viene del archivo ${data.file}. Al guardar se vuelve personalizado.`,
            none:   'Este asistente no tiene prompt. Al guardar se vuelve personalizado.'
        };

        return [
            {
                opc: 'div',
                class: 'col-12 mb-2',
                text: sources[data.source] + ' Aquí va el comportamiento (tono y reglas del negocio). Las entidades, el formato JSON y los datos de la empresa los agrega el sistema.',
                css: { fontSize: '12px', color: '#6B7280' }
            },
            {
                opc: 'textarea',
                id: 'prompt',
                lbl: 'Prompt',
                rows: 22,
                value: data.prompt || '',
                class: 'col-12 mb-2'
            }
        ];
    }
}

// -- AssistantCompanies --

class AssistantCompanies extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'AssistantCompanies';
    }

    render() {
        if ($(`#filterBar${this.PROJECT_NAME}`).length) return;

        this.layout();
        this.filterBar();
        this.lsCompanyAccess();
    }

    layout() {
        $('#container-ia-empresas').html(`<div id="filterBar${this.PROJECT_NAME}" class="mb-2"></div><div id="container${this.PROJECT_NAME}"></div>`);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'assistants_id',
                    lbl: 'Asistente',
                    class: 'col-12 col-md-3',
                    data: dataCoffeeIA.assistants || [],
                    onchange: 'assistantCompanies.lsCompanyAccess()'
                }
            ]
        });
    }

    lsCompanyAccess() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsCompanyAccess' },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [1, 3],
                right: []
            }
        });
    }

    statusCompanyAccess(companyId, assistantId, active) {
        this.swalQuestion({
            opts: {
                title: active == 1 ? '¿Encender CoffeeIA?' : '¿Apagar CoffeeIA?',
                text: active == 1
                    ? 'La empresa vuelve a ver el botón CoffeeIA de este asistente.'
                    : 'La empresa deja de ver el botón CoffeeIA de este asistente.',
                icon: 'warning'
            },
            data: { opc: 'statusCompanyAccess', companies_id: companyId, assistants_id: assistantId, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsCompanyAccess()) }
        });
    }
}
