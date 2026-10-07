// -- CoffeeIAConfig --

// Configuración básica de coffeeIA (encendido, tono, modelos y esfuerzo), la misma
// para los chats de Catálogo, Entradas y Salidas. Vive al lado de "Personalización".
class CoffeeIAConfig extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'CoffeeIA';
        this.options = {};
    }

    async render() {
        if ($(`#filterBar${this.PROJECT_NAME}`).length) return;

        this.options = await useFetch({ url: this._link, data: { opc: 'init' } }) || {};
        this.layout();
        this.filterBar();
        this.lsCoffeeIAConfig();
    }

    layout() {
        $('#container-grp-coffeeia').html(`<div id="filterBar${this.PROJECT_NAME}" class="mb-2"></div><div id="container${this.PROJECT_NAME}"></div>`);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnEditCoffeeIA',
                    text: 'Editar configuración',
                    onClick: () => this.editCoffeeIA()
                }
            ]
        });
    }

    lsCoffeeIAConfig() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsCoffeeIAConfig' },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [],
                right: []
            }
        });
    }

    async editCoffeeIA() {
        const request = await useFetch({ url: this._link, data: { opc: 'getCoffeeIA' } });

        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la configuración', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formCoffeeIAEdit',
            data: { opc: 'editCoffeeIA' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Configuración de coffeeIA' },
            autofill: request.data,
            json: this.jsonCoffeeIA(),
            success: (r) => afterSave(r, () => this.lsCoffeeIAConfig())
        });
    }

    jsonCoffeeIA() {
        return [
            {
                opc: 'select',
                id: 'active',
                lbl: 'Estado',
                data: [
                    {
                        id: '1',
                        valor: 'Encendido · el ícono sale en la navbar de Catálogo, Entradas y Salidas'
                    },
                    {
                        id: '0',
                        valor: 'Apagado · sin ícono ni chat de CoffeeIA en esos módulos'
                    }
                ],
                class: 'col-12 mb-3'
            },
            {
                opc: 'textarea',
                id: 'tone',
                lbl: 'Tono',
                placeholder: 'Ej. Amable y breve, tutea y usa palabras sencillas.',
                required: false,
                class: 'col-12 mb-3'
            },
            {
                opc: 'select',
                id: 'model',
                lbl: 'Modelo para razonamiento',
                data: this.options.modelos || [],
                class: 'col-12 mb-3'
            },
            {
                opc: 'select',
                id: 'effort',
                lbl: 'Esfuerzo',
                data: this.options.esfuerzos || [],
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'vision_model',
                lbl: 'Modelo para imagen',
                data: this.options.visiones || [],
                class: 'col-12 col-md-6 mb-3'
            }
        ];
    }
}
