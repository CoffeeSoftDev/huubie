let egresos;

class Egresos extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Egresos";
    }

    render() {
        this.layoutEgresos();
    }

    layoutEgresos() {
        $('#container-egresos').html(`
            <div id="filterBarEgresos" class="mb-4"></div>
            <div id="tableEgresos"></div>
        `);
        this.filterBarEgresos();
    }

    filterBarEgresos() {
        this.createfilterBar({
            parent: 'filterBarEgresos',
            data: [
                {
                    opc: 'select',
                    id: 'egresos_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-3',
                    onchange: 'egresos.showEgresos()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                }
            ]
        });
    }

    async showEgresos() {
        // TODO: implementar fetch de egresos
    }
}

