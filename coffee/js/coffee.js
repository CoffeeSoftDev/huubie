let api = 'ctrl/ctrl-coffee.php';
let coffee;

$(function () {
    coffee = new Coffee(api, 'root');
    coffee.init();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "App";
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'p-2',
            card: {
                filterBar: {
                    class: 'w-full my-3 p-3 border rounded-lg',
                    id: `filterBar${this.PROJECT_NAME}`
                },
                container: {
                    class: 'w-full my-3 h-full',
                    id: `container${this.PROJECT_NAME}`
                }
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "input-calendar",
                    class: "col-sm-4",
                    id: "calendar" + this.PROJECT_NAME,
                    lbl: "Consultar fecha: ",
                },
                {
                    opc: "btn",
                    class: "col-sm-2",
                    color_btn: "primary",
                    id: "btn",
                    text: "Buscar",
                    fn: `${this.PROJECT_NAME.toLowerCase()}.ls()`,
                },
            ],
        });

        dataPicker({
            parent: "calendar" + this.PROJECT_NAME,
            onSelect: () => this.ls(),
        });
    }
}

class Coffee extends App {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Coffee";
    }

    ls() {
        let rangePicker = getDataRangePicker("calendar" + this.PROJECT_NAME);

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: {
                opc: "lsCoffee",
                fi: rangePicker.fi,
                ff: rangePicker.ff
            },
            conf: { datatable: true, pag: 10 },
            coffeesoft: true,
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'corporativo',
                title: 'Lista de registros',
                subtitle: '',
                center: [1, 2],
                right: [3],
                extends: true,
            },
        });
    }

    addCoffee() {
        this.createModalForm({
            id: 'formCoffee',
            bootbox: {
                title: 'Agregar Registro',
                closeButton: true
            },
            data: { opc: 'addCoffee' },
            autofill: false,
            json: this.jsonCoffee(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Registro creado",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.ls();
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

    async editCoffee(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getCoffee", id } });

        this.createModalForm({
            id: 'formCoffee',
            bootbox: {
                title: 'Editar Registro',
                closeButton: true
            },
            data: { opc: 'editCoffee', id },
            autofill: request.data,
            json: this.jsonCoffee(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Registro actualizado",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.ls();
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

    deleteCoffee(id) {
        this.swalQuestion({
            opts: {
                title: '¿Esta seguro?',
                html: '¿Deseas eliminar este registro?',
            },
            data: { opc: "deleteCoffee", id: id },
            methods: {
                request: (data) => {
                    alert({
                        icon: "success",
                        title: "Eliminado",
                        text: "El registro fue eliminado exitosamente.",
                        btn1: true
                    });
                    this.ls();
                },
            },
        });
    }

    jsonCoffee() {
        return [
            {
                opc: "input",
                lbl: "Nombre",
                id: "name",
                tipo: "texto",
                class: "col-12 col-sm-6"
            },
            {
                opc: "input",
                lbl: "Descripcion",
                id: "description",
                tipo: "texto",
                class: "col-12 col-sm-6"
            },
            {
                opc: "textarea",
                id: "notes",
                lbl: "Notas",
                rows: 3,
                class: "col-12",
                required: false
            },
        ];
    }
}