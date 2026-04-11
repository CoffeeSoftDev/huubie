let compras;

class Compras extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Compras";
    }

    render() {
        this.layoutCompras();
    }

    layoutCompras() {
        $('#container-compras').html(`
            <div id="filterBarCompras" class="mb-4"></div>
            <div id="tableCompras"></div>
        `);
        this.filterBarCompras();
    }

    filterBarCompras() {
        this.createfilterBar({
            parent: 'filterBarCompras',
            data: [
                {
                    opc: 'select',
                    id: 'compras_sub',
                    lbl: 'Sucursal:',
                    class: 'col-12 col-md-3',
                    onchange: 'compras.showCompras()',
                    data: [
                        { id: '0', valor: 'Todas' },
                        ...this.subsidiaries
                    ]
                }
            ]
        });
    }

    async showCompras() {
        // TODO: implementar fetch de compras
    }
}

