let ingresos;

class Ingresos extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Ingresos";
    }

    render() {
        this.layoutIngresos();
    }

    layoutIngresos() {
        $('#container-ingresos').html(`
            <div id="filterBarIngresos" class="mb-4"></div>
            <div id="tableIngresos"></div>
        `);
        this.filterBarIngresos();
    }

    filterBarIngresos() {
        this.createfilterBar({
            parent: 'filterBarIngresos',
            data: [
                {
                    opc: 'select',
                    id: 'ingresos_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-3',
                    onchange: 'ingresos.showIngresos()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                }
            ]
        });
    }

    async showIngresos() {
        // TODO: implementar fetch de ingresos
    }
}

